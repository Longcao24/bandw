import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {crc16, packet, SlipDecoder, ackNumber, encodeSlip, words, DfuTransport, validateImage, checkHash} from '../dfu.mjs';
const manifest = JSON.parse(await readFile(new URL('../firmware/manifest.json', import.meta.url)));
const firmware = new Uint8Array(await readFile(new URL(`../firmware/${manifest.firmware.file}`, import.meta.url)));
const init = new Uint8Array(await readFile(new URL(`../firmware/${manifest.init.file}`, import.meta.url)));
function frames(bytes) { const result = []; new SlipDecoder(frame => result.push(frame)).feed(bytes); return result; }
function ack(sequence) { const header = [((sequence+1)%8)<<3,0,0]; return encodeSlip([...header, -header[0]&255]); }
class FakePort {
  constructor({drop=0,disconnect=false,corruptAck=false}={}) {
    this.frames=[]; this.drop=drop; this.disconnect=disconnect; this.corruptAck=corruptAck;
    this.readable=new ReadableStream({start: controller => this.controller=controller});
    this.writable=new WritableStream({write: bytes => {
      const [frame]=frames(bytes);this.frames.push(frame);
      const seq=frame[0]&7;
      if(this.disconnect){this.controller.close();return;}
      if(this.drop-- >0)return;
      const response=ack(seq);
      if(this.corruptAck)response[4]^=1;
      // Deliberately fragment every acknowledgement into several reads.
      this.controller.enqueue(response.slice(0,2));this.controller.enqueue(response.slice(2,4));this.controller.enqueue(response.slice(4));
    }});
  }
  async open(options){this.opened=options;}
  async setSignals(signals){this.signals=signals;}
  async close(){this.closed=true;}
}
test('CRC matches Nordic CCITT known vector and firmware init packet',()=>{
  assert.equal(crc16(new TextEncoder().encode('123456789')),0x29b1);validateImage(firmware,init);
});
test('published bytes match SHA256; damaged firmware and init are rejected',async()=>{
  await checkHash(firmware,manifest.firmware.sha256);await checkHash(init,manifest.init.sha256);
  const bad=firmware.slice();bad[10]^=1;
  assert.throws(()=>validateImage(bad,init),/CRC/);await assert.rejects(checkHash(bad,manifest.firmware.sha256));
  assert.throws(()=>validateImage(firmware,init.slice(0,-1)));
  const wrong=init.slice();wrong[0]=0;assert.throws(()=>validateImage(firmware,wrong));
});
test('SLIP handles escaped bytes, chunk boundaries, multiple frames and malformed data',()=>{
  const results=[];const decoder=new SlipDecoder(frame=>results.push([...frame]));
  const data=encodeSlip([0xc0,0xdb,1,2]);for(const byte of data)decoder.feed([byte]);
  decoder.feed([0xc0,0xdb,3,0xc0]);decoder.feed(encodeSlip([4]));
  assert.deepEqual(results,[[0xc0,0xdb,1,2],[4]]);
});
test('HCI frame has expected type, size, checksum, CRC and ACK validation',()=>{
  const payload=words(3,4,0,0,336928);const [frame]=frames(packet(payload,1));
  assert.equal(frame[0],0xd1);assert.equal(frame[1],0x4e);assert.equal(frame[2],1);
  assert.equal((frame[0]+frame[1]+frame[2]+frame[3])&255,0);
  assert.deepEqual(frame.slice(4,-2),payload);
  assert.equal(frame.at(-2)|(frame.at(-1)<<8),crc16(frame.slice(0,-2)));
  assert.equal(ackNumber(frames(ack(7))[0]),0);
  assert.equal(ackNumber(Uint8Array.from([8,0,0,0])),null);
});
test('full firmware transfer has exact payload and only APP start/init/data/stop commands',async()=>{
  const port=new FakePort();const transport=new DfuTransport(port,{wait:async()=>{}});let progress=0;
  await transport.open();await transport.flash(firmware,init,value=>{assert.ok(value>=progress);progress=value;});await transport.close();
  assert.equal(progress,100);assert.ok(port.closed);
  const payloads=port.frames.map(frame=>frame.slice(4,-2));
  assert.deepEqual(payloads[0],words(3,4,0,0,firmware.length));
  assert.deepEqual(payloads[1],Uint8Array.from([...words(1),...init,0,0]));
  assert.deepEqual(payloads.at(-1),words(5));
  const data=payloads.slice(2,-1);for(const p of data)assert.deepEqual(p.slice(0,4),words(4));
  assert.deepEqual(Uint8Array.from(data.flatMap(p=>[...p.slice(4)])),firmware);
  port.frames.forEach((frame,index)=>assert.equal(frame[0]&7,(index+1)%8));
});
test('lost ACK retries exact same packet without advancing sequence',async()=>{
  const port=new FakePort({drop:1});const transport=new DfuTransport(port,{wait:async()=>{},ackTimeout:5});
  await transport.open();await transport.send(words(4,100));await transport.close();
  assert.equal(port.frames.length,2);assert.deepEqual(port.frames[0],port.frames[1]);
});
test('corrupt acknowledgements cause failure, never success',async()=>{
  const port=new FakePort({corruptAck:true});const transport=new DfuTransport(port,{wait:async()=>{},ackTimeout:5});
  await transport.open();await assert.rejects(transport.send(words(4,100)),/không phản hồi/);await transport.close();
});
test('USB unplug during transfer rejects outstanding acknowledgement',async()=>{
  const port=new FakePort({disconnect:true});const transport=new DfuTransport(port,{wait:async()=>{},ackTimeout:50});
  await transport.open();await assert.rejects(transport.send(words(4,100)),/ngắt USB/);await transport.close();
});
