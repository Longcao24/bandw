// Course manifest. One file per unit (owned by content writers). Ids/file names are fixed.
import u01 from './unit01.js'; import u02 from './unit02.js'; import u03 from './unit03.js'; import u04 from './unit04.js';
import u05 from './unit05.js'; import u06 from './unit06.js'; import u07 from './unit07.js'; import u08 from './unit08.js';
import u09 from './unit09.js'; import u10 from './unit10.js';

export const course = {
  id: 'bandw-khkt',
  title: 'Học BandW: Hiểu dự án từ cổ tay đến giọng nói',
  description: 'Giáo trình trực quan cho đội thi KHKT: từ cảm biến trên cổ tay đến câu nói trên điện thoại, để tự tin phản biện.',
  units: [u01, u02, u03, u04, u05, u06, u07, u08, u09, u10],
};
export default course;
