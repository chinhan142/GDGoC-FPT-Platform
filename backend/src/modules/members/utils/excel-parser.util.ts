import * as XLSX from 'xlsx';
import { DepartmentType, Role } from '@prisma/client';

export interface ParsedMemberRow {
  rowNumber: number;
  mssv: string;
  fullName: string;
  email: string;
  phoneNumber?: string;
  departmentCode?: DepartmentType;
  role?: Role;
  position?: string;
}

export function parseMembersExcel(
  buffer: Buffer,
  fallbackDepartment?: DepartmentType,
  fallbackRole: Role = Role.MEMBER,
): { validRows: ParsedMemberRow[]; parseErrors: string[] } {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) {
    return {
      validRows: [],
      parseErrors: ['Tệp Excel trống hoặc không có Sheet hợp lệ'],
    };
  }

  const worksheet = workbook.Sheets[firstSheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: '',
  });

  if (!rawData || rawData.length < 2) {
    return {
      validRows: [],
      parseErrors: ['Tệp Excel không có dòng dữ liệu nào'],
    };
  }

  // Row 0 is headers
  const headers: string[] = rawData[0].map((h: any) =>
    String(h).trim().toLowerCase(),
  );

  const getColIndex = (...keys: string[]) => {
    return headers.findIndex((h) => keys.some((k) => h.includes(k)));
  };

  const mssvIdx = getColIndex('mssv', 'mã số', 'student id', 'masv', 'code');
  const nameIdx = getColIndex('họ và tên', 'họ tên', 'full name', 'name', 'tên');
  const emailIdx = getColIndex('email', 'mail');
  const phoneIdx = getColIndex('phone', 'sđt', 'điện thoại', 'sdt');
  const deptIdx = getColIndex('ban', 'department', 'phòng ban');
  const roleIdx = getColIndex('role', 'vai trò', 'chức vụ');
  const posIdx = getColIndex('position', 'chức danh', 'vị trí');

  const validRows: ParsedMemberRow[] = [];
  const parseErrors: string[] = [];

  const mssvRegex = /^(SE|SS|IA|IB|GD|CS|IT|HE)\d{6}$/i;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const normalizeDept = (val: string): DepartmentType | undefined => {
    if (!val) return fallbackDepartment;
    const clean = val.toUpperCase().replace(/\s+/g, '_');
    if (Object.values(DepartmentType).includes(clean as DepartmentType)) {
      return clean as DepartmentType;
    }
    // Mapping alias
    if (clean.includes('AI') || clean.includes('TRÍ TUỆ')) return DepartmentType.TECH_AI;
    if (clean.includes('CLOUD') || clean.includes('ĐÁM MÂY')) return DepartmentType.TECH_CLOUD;
    if (clean.includes('WEB')) return DepartmentType.TECH_WEB;
    if (clean.includes('RESEARCH') || clean.includes('NGHIÊN CỨU')) return DepartmentType.TECH_RESEARCH;
    if (clean.includes('MEDIA') || clean.includes('TRUYỀN THÔNG')) return DepartmentType.MEDIA;
    if (clean.includes('HR') || clean.includes('EVENT') || clean.includes('NHÂN SỰ') || clean.includes('SỰ KIỆN')) return DepartmentType.HR_EVENT;
    if (clean.includes('EXECUTIVE') || clean.includes('CHỦ NHIỆM') || clean.includes('BCN')) return DepartmentType.EXECUTIVE;

    return fallbackDepartment;
  };

  const normalizeRole = (val: string): Role => {
    if (!val) return fallbackRole;
    const clean = val.toUpperCase().replace(/\s+/g, '_');
    if (Object.values(Role).includes(clean as Role)) {
      return clean as Role;
    }
    if (clean.includes('LEAD') || clean.includes('CHỦ NHIỆM')) return Role.LEAD;
    if (clean.includes('TRƯỞNG') || clean.includes('DEPT_LEAD')) return Role.DEPARTMENT_LEAD;
    if (clean.includes('CỐ VẤN') || clean.includes('ADVISOR')) return Role.ADVISOR;
    if (clean.includes('CTV') || clean.includes('THỬ VIỆC') || clean.includes('COLLABORATOR')) return Role.COLLABORATOR;

    return fallbackRole;
  };

  for (let i = 1; i < rawData.length; i++) {
    const row = rawData[i];
    const rowNum = i + 1;

    // Skip completely empty rows
    if (!row || row.every((c: any) => String(c).trim() === '')) {
      continue;
    }

    const rawMssv = mssvIdx !== -1 ? String(row[mssvIdx] || '').trim().toUpperCase() : '';
    const rawName = nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '';
    const rawEmail = emailIdx !== -1 ? String(row[emailIdx] || '').trim().toLowerCase() : '';
    const rawPhone = phoneIdx !== -1 ? String(row[phoneIdx] || '').trim() : undefined;
    const rawDept = deptIdx !== -1 ? String(row[deptIdx] || '').trim() : '';
    const rawRole = roleIdx !== -1 ? String(row[roleIdx] || '').trim() : '';
    const rawPos = posIdx !== -1 ? String(row[posIdx] || '').trim() : undefined;

    if (!rawMssv || !mssvRegex.test(rawMssv)) {
      parseErrors.push(`Dòng ${rowNum}: MSSV '${rawMssv}' không hợp lệ`);
      continue;
    }

    if (!rawName) {
      parseErrors.push(`Dòng ${rowNum}: Họ tên không được để trống`);
      continue;
    }

    if (!rawEmail || !emailRegex.test(rawEmail)) {
      parseErrors.push(`Dòng ${rowNum}: Email '${rawEmail}' không hợp lệ`);
      continue;
    }

    const departmentCode = normalizeDept(rawDept);
    if (!departmentCode) {
      parseErrors.push(`Dòng ${rowNum}: Chưa xác định được Ban chuyên môn`);
      continue;
    }

    const role = normalizeRole(rawRole);

    validRows.push({
      rowNumber: rowNum,
      mssv: rawMssv,
      fullName: rawName,
      email: rawEmail,
      phoneNumber: rawPhone || undefined,
      departmentCode,
      role,
      position: rawPos || undefined,
    });
  }

  return { validRows, parseErrors };
}
