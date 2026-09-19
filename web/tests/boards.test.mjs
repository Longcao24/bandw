import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BOARDS,portIds,matchesManifest} from '../boards.mjs';
import {validateImage,checkHash} from '../dfu.mjs';
for (const [name,board] of Object.entries(BOARDS)) {
 test(`${name}: correct binary/init, hashes, and rejects other board manifest`,async()=>{
  const manifest=JSON.parse(await readFile(new URL(`../firmware/${board.manifest}`,import.meta.url)));
  assert.ok(matchesManifest(board,manifest));
  const other=name==='sense'?BOARDS.plus:BOARDS.sense;
  assert.equal(matchesManifest(other,manifest),false);
  const firmware=new Uint8Array(await readFile(new URL(`../firmware/${manifest.firmware.file}`,import.meta.url)));
  const init=new Uint8Array(await readFile(new URL(`../firmware/${manifest.init.file}`,import.meta.url)));
  assert.equal(firmware.length,manifest.firmware.size);validateImage(firmware,init);
  await checkHash(firmware,manifest.firmware.sha256);await checkHash(init,manifest.init.sha256);
 });
}
test('standard Sense ports are visible only under standard Sense; boot filter excludes running firmware',()=>{
 assert.deepEqual(portIds(BOARDS.sense),[0x0045,0x0145,0x8045]);
 assert.deepEqual(portIds(BOARDS.sense,true),[0x0045,0x0145]);
 assert.ok(!portIds(BOARDS.plus).some(id=>portIds(BOARDS.sense).includes(id)));
 assert.ok(!portIds(BOARDS.plus,true).includes(0x8064));
});
