// Deploy as a Web App: execute as the Sheet owner; access Anyone.
// Required Script Properties: SPREADSHEET_ID, WEBHOOK_SECRET.
const RECRUITMENT_HEADERS = [
  'Timestamp', 'Mã UV', 'Họ và tên', 'Email', 'Số điện thoại', 'MSSV',
  'Chuyên ngành', 'Kỳ học', 'Facebook', 'Ban NV1', 'Ban NV2',
  'Link Portfolio/CV', 'Công nghệ / Kỹ năng', 'Dự án tâm đắc',
  'Mục tiêu gia nhập', 'Điều ấn tượng gần đây (theo ban NV1)', 'Lời nhắn', 'Đánh giá Form (10)',
  'Kết quả Vòng 1', 'Trạng thái gửi mail', 'Ghi chú',
  '_requestId', '_cycle', '_payloadHash'
];
const RECRUITMENT_MAJORS = { SE: 'Kỹ thuật phần mềm (SE)', IA: 'An toàn thông tin (IA)', AI: 'Trí tuệ nhân tạo (AI)', GD: 'Thiết kế mỹ thuật số (GD)', MC: 'Truyền thông đa phương tiện (MC)', IB: 'Quản trị kinh doanh (IB)', OTHER: 'Ngành khác' };
const RECRUITMENT_SEMESTERS = { FRESHMAN: 'Tân sinh viên', SEM_1_3: 'Kỳ 1 - 3', SEM_4_6: 'Kỳ 4 - 6', SEM_7_PLUS: 'Kỳ 7+' };
const RECRUITMENT_REQUEST_INDEX = RECRUITMENT_HEADERS.indexOf('_requestId');
const RECRUITMENT_CYCLE_INDEX = RECRUITMENT_HEADERS.indexOf('_cycle');
const RECRUITMENT_HASH_INDEX = RECRUITMENT_HEADERS.indexOf('_payloadHash');

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
  if (!RECRUITMENT_MAJORS[d.major] || !RECRUITMENT_SEMESTERS[d.semester]) return false;
  if (departments.indexOf(d.nv1) < 0 || (d.nv2 && (departments.indexOf(d.nv2) < 0 || d.nv2 === d.nv1)) || d.consent !== true) return false;
  if ([d.facebookUrl, d.portfolioUrl].some(function (v) { return v.length > 1000 || !/^https:\/\/[^\s/]+\.[^\s/]+(?:\/[^\s]*)?$/.test(v); })) return false;
  if (d.projectHighlight.trim().length < 10 || d.projectHighlight.length > 5000 || d.goals.trim().length < 10 || d.goals.length > 5000) return false;
  const tech = ['AI', 'Cloud', 'Web Development', 'Research'].indexOf(d.nv1) >= 0;
  const skills = tech ? d.techStack : d.nonTechSkills;
  if (typeof skills !== 'string' || !skills.trim() || skills.length > 3000) return false;
  if (d.message && (typeof d.message !== 'string' || d.message.length > 3000)) return false;
  // Older DB snapshots have no answer; never rewrite their signed payload.
  if (d.inspiration !== undefined && (typeof d.inspiration !== 'string' || d.inspiration.trim().length < 10 || d.inspiration.length > 5000)) return false;
  return true;
}

// Read and write by header name. Moving a complete column is supported.
function recruitmentReadSheet_(sheet) {
  let lastRow = sheet.getLastRow();
  if (!lastRow) {
    if (sheet.getMaxColumns() < 24) sheet.insertColumnsAfter(sheet.getMaxColumns(), 24 - sheet.getMaxColumns());
    sheet.appendRow(RECRUITMENT_HEADERS);
    sheet.getRange(1, 1, 1, 24).setFontWeight('bold').setBackground('#E8F0FE');
    sheet.setFrozenRows(1);
    lastRow = 1;
  }
  const width = Math.min(sheet.getMaxColumns(), 25);
  const values = sheet.getRange(1, 1, lastRow, width).getValues();
  const headers = values[0];
  const normalize = function (value) { return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' '); };
  const names = headers.map(normalize);
  const base = RECRUITMENT_HEADERS.filter(function (_, index) { return index !== 15; });
  const nonEmpty = names.filter(function (name) { return name !== ''; });
  const oldCommitment = names.indexOf('Mức cam kết');
  if (nonEmpty.length === 24 && oldCommitment >= 0 && base.every(function (name) { return names.indexOf(name) >= 0 && names.indexOf(name) === names.lastIndexOf(name); })) {
    sheet.deleteColumn(oldCommitment + 1);
    values.forEach(function (row) { row.splice(oldCommitment, 1); });
    names.splice(oldCommitment, 1);
  }
  if (names.filter(function (name) { return name !== ''; }).length === 23 && base.every(function (name) { return names.indexOf(name) >= 0 && names.indexOf(name) === names.lastIndexOf(name); })) {
    sheet.insertColumnBefore(16);
    sheet.getRange(1, 16, 1, 1).setValues([[RECRUITMENT_HEADERS[15]]]).setFontWeight('bold').setBackground('#E8F0FE');
    values.forEach(function (row, index) { row.splice(15, 0, index === 0 ? RECRUITMENT_HEADERS[15] : ''); });
    names.splice(15, 0, RECRUITMENT_HEADERS[15]);
  }
  if (RECRUITMENT_HEADERS.some(function (name) { return names.indexOf(name) < 0 || names.indexOf(name) !== names.lastIndexOf(name); })) return null;
  if (names.slice(0, 24).some(function (name) { return RECRUITMENT_HEADERS.indexOf(name) < 0; }) || names.slice(24).some(function (name) { return name !== ''; })) return null;
  sheet.showColumns(1, 24);
  ['_requestId', '_cycle', '_payloadHash'].forEach(function (name) { sheet.hideColumns(names.indexOf(name) + 1, 1); });
  const canonical = values.map(function (row) { return RECRUITMENT_HEADERS.map(function (name) { return row[names.indexOf(name)] === undefined ? '' : row[names.indexOf(name)]; }); });
  canonical.writeOrder = names.slice(0, 24).map(function (name) { return RECRUITMENT_HEADERS.indexOf(name); });
  return canonical;
}

// Run once from the Apps Script editor to migrate the configured tab immediately.
// Re-running is safe; doPost also migrates the tab on the first valid sync.
function migrateRecruitmentSheet() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw new Error('Sheet đang được đồng bộ. Hãy thử lại.');
  try {
    const properties = PropertiesService.getScriptProperties();
    const sheetId = properties.getProperty('SPREADSHEET_ID');
    if (!sheetId) throw new Error('Chưa cấu hình SPREADSHEET_ID.');
    const book = SpreadsheetApp.openById(sheetId);
    const name = properties.getProperty('SHEET_NAME') || 'Ung vien tu Web';
    const sheet = book.getSheetByName(name);
    if (!sheet) throw new Error('Không tìm thấy tab đã cấu hình trong SHEET_NAME.');
    if (!recruitmentReadSheet_(sheet)) throw new Error('SCHEMA: cấu trúc tab không khớp; chưa tự chuyển đổi.');
    SpreadsheetApp.flush();
    return { columns: RECRUITMENT_HEADERS.length };
  } finally { lock.releaseLock(); }
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
    const values = recruitmentReadSheet_(sheet);
    if (!values) return recruitmentJson_({ status: 'error', code: 'SCHEMA' });
    const rows = values.slice(1);
    let duplicate = false;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[RECRUITMENT_REQUEST_INDEX] === data.requestId) return recruitmentJson_(row[RECRUITMENT_HASH_INDEX] === digest ? { status: 'success', candidateId: row[1] } : { status: 'error', code: 'CONFLICT' });
      if (row[1] === data.candidateId) return recruitmentJson_({ status: 'error', code: 'CONFLICT' });
      if (row[RECRUITMENT_CYCLE_INDEX] === cycle && (String(row[3]).toLowerCase() === data.email.toLowerCase() || String(row[5]).toUpperCase() === data.studentId.toUpperCase())) duplicate = true;
    }
    if (duplicate) return recruitmentJson_({ status: 'error', code: 'DUPLICATE' });
    const candidateId = data.candidateId;
    const skills = ['AI', 'Cloud', 'Web Development', 'Research'].indexOf(data.nv1) >= 0 ? data.techStack : data.nonTechSkills;
    const row = [new Date(), candidateId, data.fullName, data.email.toLowerCase(), "'" + data.phone, data.studentId.toUpperCase(), RECRUITMENT_MAJORS[data.major], RECRUITMENT_SEMESTERS[data.semester], data.facebookUrl, data.nv1, data.nv2 || '', data.portfolioUrl, skills, data.projectHighlight, data.goals, data.inspiration || '', data.message || '', '', 'Xem xét', 'Chưa gửi', '', data.requestId, cycle, digest];
    sheet.appendRow(values.writeOrder.map(function (index) { return row[index]; }).map(function (cell) { return typeof cell === 'string' ? recruitmentSafeCell_(cell) : cell; }));
    SpreadsheetApp.flush();
    return recruitmentJson_({ status: 'success', candidateId: candidateId });
  } catch (error) {
    // Do not expose applicant data, Sheet details or secret in responses/logs.
    return recruitmentJson_({ status: 'error', code: 'UNAVAILABLE' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function doGet() { return recruitmentJson_({ service: 'GDGoC recruitment', protocol: 'gdgoc-recruitment-v2', sheetColumns: RECRUITMENT_HEADERS.length, sheetLayout: 'header-mapped-v3' }); }
