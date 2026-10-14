// Deploy as a Web App: execute as the Sheet owner; access Anyone.
// Required Script Properties: SPREADSHEET_ID, WEBHOOK_SECRET.
const RECRUITMENT_HEADERS = [
  'Timestamp', 'Mã UV', 'Họ và tên', 'Email', 'Số điện thoại', 'MSSV',
  'Chuyên ngành', 'Kỳ học', 'Facebook', 'Ban NV1', 'Ban NV2',
  'Link Portfolio/CV', 'Công nghệ / Kỹ năng', 'Dự án tâm đắc',
  'Mục tiêu gia nhập', 'Mức cam kết', 'Lời nhắn', 'Đánh giá Form (10)',
  'Kết quả Vòng 1', 'Trạng thái gửi mail', 'Ghi chú',
  '_requestId', '_cycle', '_payloadHash'
];
const RECRUITMENT_MAJORS = { SE: 'Kỹ thuật phần mềm (SE)', IA: 'An toàn thông tin (IA)', AI: 'Trí tuệ nhân tạo (AI)', GD: 'Thiết kế mỹ thuật số (GD)', MC: 'Truyền thông đa phương tiện (MC)', IB: 'Quản trị kinh doanh (IB)', OTHER: 'Ngành khác' };
const RECRUITMENT_SEMESTERS = { FRESHMAN: 'Tân sinh viên', SEM_1_3: 'Kỳ 1 - 3', SEM_4_6: 'Kỳ 4 - 6', SEM_7_PLUS: 'Kỳ 7+' };
const RECRUITMENT_COMMITMENTS = { '5_8_HOURS': 'Có thể dành tối thiểu 5–8 tiếng/tuần cho CLB', WILL_ARRANGE: 'Lịch học khá bận nhưng sẽ cố gắng sắp xếp', LIMITED: 'Khó đảm bảo thời gian thường xuyên' };

function recruitmentJson_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function recruitmentHex_(bytes) {
  return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}
function recruitmentSafeCell_(value) {
  const text = String(value || '');
  return /^[\s]*[=+@\-]/.test(text) ? "'" + text : text;
}
function recruitmentValid_(d) {
  const departments = ['AI', 'Cloud', 'Web Development', 'Research', 'Media', 'HR & Event'];
  const required = ['fullName', 'email', 'phone', 'studentId', 'facebookUrl', 'portfolioUrl', 'projectHighlight', 'goals'];
  if (!d || typeof d !== 'object' || required.some(function (key) { return typeof d[key] !== 'string' || !d[key].trim(); })) return false;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(d.requestId || '')) return false;
  if (!/^UV\d{3,}$/.test(d.candidateId || '')) return false;
  if (typeof d.cycle !== 'string' || !d.cycle.trim() || d.cycle.length > 120) return false;
  if (d.fullName.length < 2 || d.fullName.length > 120 || d.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) return false;
  if (!/^(?:\+84|0)\d{9,10}$/.test(d.phone) || !/^[A-Z]{2,4}\d{6,8}$/.test(d.studentId)) return false;
  if (!RECRUITMENT_MAJORS[d.major] || !RECRUITMENT_SEMESTERS[d.semester] || !RECRUITMENT_COMMITMENTS[d.commitment]) return false;
  if (departments.indexOf(d.nv1) < 0 || (d.nv2 && (departments.indexOf(d.nv2) < 0 || d.nv2 === d.nv1)) || d.consent !== true) return false;
  if ([d.facebookUrl, d.portfolioUrl].some(function (v) { return v.length > 1000 || !/^https:\/\/[^\s/]+\.[^\s/]+(?:\/[^\s]*)?$/.test(v); })) return false;
  if (d.projectHighlight.trim().length < 10 || d.projectHighlight.length > 5000 || d.goals.trim().length < 10 || d.goals.length > 5000) return false;
  const tech = ['AI', 'Cloud', 'Web Development', 'Research'].indexOf(d.nv1) >= 0;
  const skills = tech ? d.techStack : d.nonTechSkills;
  if (typeof skills !== 'string' || !skills.trim() || skills.length > 3000) return false;
  if (d.message && (typeof d.message !== 'string' || d.message.length > 3000)) return false;
  return true;
}

function doPost(e) {
  let lock;
  try {
    const properties = PropertiesService.getScriptProperties();
    const secret = properties.getProperty('WEBHOOK_SECRET');
    const sheetId = properties.getProperty('SPREADSHEET_ID');
    if (!secret || secret.length < 32 || !sheetId) return recruitmentJson_({ status: 'error', code: 'CONFIG' });
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length > 100000) return recruitmentJson_({ status: 'error', code: 'INVALID' });
    const envelope = JSON.parse(e.postData.contents);
    if (typeof envelope.payload !== 'string' || !/^[0-9a-f]{64}$/.test(envelope.signature || '')) return recruitmentJson_({ status: 'error', code: 'UNAUTHORIZED' });
    const expected = recruitmentHex_(Utilities.computeHmacSha256Signature(envelope.payload, secret, Utilities.Charset.UTF_8));
    let mismatch = 0;
    for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ envelope.signature.charCodeAt(i);
    if (mismatch) return recruitmentJson_({ status: 'error', code: 'UNAUTHORIZED' });
    const data = JSON.parse(envelope.payload);
    if (!recruitmentValid_(data)) return recruitmentJson_({ status: 'error', code: 'INVALID' });
    // Signed DB snapshot keeps its original cycle even after recruitment closes.
    const cycle = data.cycle;
    const digest = recruitmentHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, envelope.payload, Utilities.Charset.UTF_8));
    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return recruitmentJson_({ status: 'error', code: 'BUSY' });
    const book = SpreadsheetApp.openById(sheetId);
    const name = properties.getProperty('SHEET_NAME') || 'Ung vien tu Web';
    let sheet = book.getSheetByName(name);
    if (!sheet) sheet = book.insertSheet(name);
    let lastRow = sheet.getLastRow();
    if (!lastRow) {
      sheet.appendRow(RECRUITMENT_HEADERS);
      sheet.getRange(1, 1, 1, RECRUITMENT_HEADERS.length).setFontWeight('bold').setBackground('#E8F0FE');
      sheet.setFrozenRows(1);
      sheet.hideColumns(22, 3);
      lastRow = 1;
    }
    // Read headers and applicants together to avoid separate Sheets round trips.
    const values = sheet.getRange(1, 1, lastRow, RECRUITMENT_HEADERS.length).getValues();
    const headers = values[0];
    if (RECRUITMENT_HEADERS.some(function (header, index) { return headers[index] !== header; })) return recruitmentJson_({ status: 'error', code: 'SCHEMA' });
    const rows = values.slice(1);
    let duplicate = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[21] === data.requestId) return recruitmentJson_(row[23] === digest ? { status: 'success', candidateId: row[1] } : { status: 'error', code: 'CONFLICT' });
      if (row[1] === data.candidateId) return recruitmentJson_({ status: 'error', code: 'CONFLICT' });
      if (row[22] === cycle && (String(row[3]).toLowerCase() === data.email.toLowerCase() || String(row[5]).toUpperCase() === data.studentId.toUpperCase())) duplicate = true;
    }
    if (duplicate) return recruitmentJson_({ status: 'error', code: 'DUPLICATE' });
    const candidateId = data.candidateId;
    const skills = ['AI', 'Cloud', 'Web Development', 'Research'].indexOf(data.nv1) >= 0 ? data.techStack : data.nonTechSkills;
    const row = [new Date(), candidateId, data.fullName, data.email.toLowerCase(), "'" + data.phone, data.studentId.toUpperCase(), RECRUITMENT_MAJORS[data.major], RECRUITMENT_SEMESTERS[data.semester], data.facebookUrl, data.nv1, data.nv2 || '', data.portfolioUrl, skills, data.projectHighlight, data.goals, RECRUITMENT_COMMITMENTS[data.commitment], data.message || '', '', 'Xem xét', 'Chưa gửi', '', data.requestId, cycle, digest];
    sheet.appendRow(row.map(function (cell) { return typeof cell === 'string' ? recruitmentSafeCell_(cell) : cell; }));
    SpreadsheetApp.flush();
    return recruitmentJson_({ status: 'success', candidateId: candidateId });
  } catch (error) {
    // Do not expose applicant data, Sheet details or secret in responses/logs.
    return recruitmentJson_({ status: 'error', code: 'UNAVAILABLE' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function doGet() { return recruitmentJson_({ service: 'GDGoC recruitment', protocol: 'gdgoc-recruitment-v2' }); }
