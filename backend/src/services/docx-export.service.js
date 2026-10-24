'use strict';

const path = require('node:path');
const fs = require('node:fs');
const AdmZip = require('adm-zip');

const TEMPLATE_PATH = path.join(__dirname, '../../templates/report_template.docx');

function escapeXml(unsafe) {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function p(text, opts = {}) {
  const align = opts.align || 'right';
  const size = opts.size || 20; // half-points (20 = 10pt)
  const bold = opts.bold ? '<w:b/>' : '';
  const color = opts.color ? `<w:color w:val="${opts.color}"/>` : '<w:color w:val="221F20"/>';
  const before = opts.before !== undefined ? opts.before : 40;
  const after = opts.after !== undefined ? opts.after : 40;

  return `<w:p>
    <w:pPr>
      <w:jc w:val="${align}"/>
      <w:spacing w:before="${before}" w:after="${after}"/>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:cs="Arial"/>
        <w:rtl/>
        ${bold}
        <w:sz w:val="${size}"/>
        <w:szCs w:val="${size}"/>
        ${color}
      </w:rPr>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Arial" w:cs="Arial"/>
        <w:rtl/>
        ${bold}
        <w:sz w:val="${size}"/>
        <w:szCs w:val="${size}"/>
        ${color}
      </w:rPr>
      <w:t xml:space="preserve">${escapeXml(text)}</w:t>
    </w:r>
  </w:p>`;
}

function table(headers, rows, colWidths = [], headerBg = '221F20') {
  const totalWidth = 9638; // standard content width between margins on A4 in twips
  const defaultColWidth = Math.floor(totalWidth / headers.length);
  const widths = headers.map((_, i) => colWidths[i] || defaultColWidth);

  const gridXml = widths.map(w => `<w:gridCol w:w="${w}"/>`).join('');

  const headerRowXml = `<w:tr>
    <w:trPr><w:tblHeader/></w:trPr>
    ${headers.map((h, i) => `
      <w:tc>
        <w:tcPr>
          <w:tcW w:w="${widths[i]}" w:type="dxa"/>
          <w:shd w:val="clear" w:color="auto" w:fill="${headerBg}"/>
          <w:vAlign w:val="center"/>
        </w:tcPr>
        <w:p>
          <w:pPr>
            <w:jc w:val="center"/>
            <w:spacing w:before="90" w:after="90"/>
            <w:rPr><w:rFonts w:ascii="Arial" w:cs="Arial"/><w:rtl/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="FFFFFF"/></w:rPr>
          </w:pPr>
          <w:r>
            <w:rPr><w:rFonts w:ascii="Arial" w:cs="Arial"/><w:rtl/><w:b/><w:sz w:val="20"/><w:szCs w:val="20"/><w:color w:val="FFFFFF"/></w:rPr>
            <w:t>${escapeXml(h)}</w:t>
          </w:r>
        </w:p>
      </w:tc>
    `).join('')}
  </w:tr>`;

  const dataRowsXml = rows.map((row, rIdx) => {
    const isEven = rIdx % 2 === 1;
    const defaultBg = isEven ? 'FAF9F5' : 'FFFFFF';
    return `<w:tr>
      ${row.map((cell, cIdx) => {
        const text = typeof cell === 'object' && cell !== null ? cell.text : cell;
        const color = typeof cell === 'object' && cell !== null && cell.color ? cell.color : '221F20';
        const bold = typeof cell === 'object' && cell !== null && cell.bold;
        const align = typeof cell === 'object' && cell !== null && cell.align ? cell.align : 'center';
        const bg = typeof cell === 'object' && cell !== null && cell.bg ? cell.bg : defaultBg;
        return `
          <w:tc>
            <w:tcPr>
              <w:tcW w:w="${widths[cIdx]}" w:type="dxa"/>
              <w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>
              <w:vAlign w:val="center"/>
            </w:tcPr>
            <w:p>
              <w:pPr>
                <w:jc w:val="${align}"/>
                <w:spacing w:before="60" w:after="60"/>
                <w:rPr>
                  <w:rFonts w:ascii="Arial" w:cs="Arial"/><w:rtl/>
                  ${bold ? '<w:b/>' : ''}
                  <w:sz w:val="18"/><w:szCs w:val="18"/>
                  <w:color w:val="${color}"/>
                </w:rPr>
              </w:pPr>
              <w:r>
                <w:rPr>
                  <w:rFonts w:ascii="Arial" w:cs="Arial"/><w:rtl/>
                  ${bold ? '<w:b/>' : ''}
                  <w:sz w:val="18"/><w:szCs w:val="18"/>
                  <w:color w:val="${color}"/>
                </w:rPr>
                <w:t xml:space="preserve">${escapeXml(text)}</w:t>
              </w:r>
            </w:p>
          </w:tc>
        `;
      }).join('')}
    </w:tr>`;
  }).join('');

  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="${totalWidth}" w:type="dxa"/>
      <w:jc w:val="center"/>
      <w:bidiVisual/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="6" w:space="0" w:color="B59045"/>
        <w:left w:val="single" w:sz="6" w:space="0" w:color="B59045"/>
        <w:bottom w:val="single" w:sz="6" w:space="0" w:color="B59045"/>
        <w:right w:val="single" w:sz="6" w:space="0" w:color="B59045"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E0DACB"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E0DACB"/>
      </w:tblBorders>
      <w:tblCellMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="100" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="100" w:type="dxa"/>
      </w:tblCellMar>
    </w:tblPr>
    <w:tblGrid>${gridXml}</w:tblGrid>
    ${headerRowXml}
    ${dataRowsXml}
  </w:tbl>`;
}

function buildDocumentXml(bodyXml) {
  const sectPr = `<w:sectPr w:rsidR="00C05355" w:rsidSect="00034616"><w:headerReference w:type="default" r:id="rId8"/><w:footerReference w:type="default" r:id="rId9"/><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1984" w:right="1134" w:bottom="1417" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/><w:cols w:space="720"/><w:docGrid w:linePitch="360"/></w:sectPr>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" xmlns:cx2="http://schemas.microsoft.com/office/drawing/2015/10/21/chartex" xmlns:cx3="http://schemas.microsoft.com/office/drawing/2016/5/9/chartex" xmlns:cx4="http://schemas.microsoft.com/office/drawing/2016/5/10/chartex" xmlns:cx5="http://schemas.microsoft.com/office/drawing/2016/5/11/chartex" xmlns:cx6="http://schemas.microsoft.com/office/drawing/2016/5/12/chartex" xmlns:cx7="http://schemas.microsoft.com/office/drawing/2016/5/13/chartex" xmlns:cx8="http://schemas.microsoft.com/office/drawing/2016/5/14/chartex" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink" xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:oel="http://schemas.microsoft.com/office/2019/extlst" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16du="http://schemas.microsoft.com/office/word/2023/wordml/word16du" xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash" xmlns:w16sdtfl="http://schemas.microsoft.com/office/word/2024/wordml/sdtformatlock" xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh w16sdtfl w16du wp14">
<w:body>
${bodyXml}
${sectPr}
</w:body>
</w:document>`;
}

function createDocxFromTemplate(bodyXml) {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error('Template file not found at: ' + TEMPLATE_PATH);
  }
  const zip = new AdmZip(TEMPLATE_PATH);
  const documentXml = buildDocumentXml(bodyXml);
  zip.updateFile('word/document.xml', Buffer.from(documentXml, 'utf8'));
  return zip.toBuffer();
}

/**
 * Generates official branded .docx report for an employee's individual dossier.
 */
function generateEmployeeDossierDocx(dossier, from, to) {
  const emp = dossier.employee;
  const sum = dossier.summary;
  const nowStr = new Date().toLocaleString('ar-YE', { timeZone: 'Asia/Aden' });

  const bodyParts = [
    p('تقرير الحضور والانصراف الرسمي - سجل الموظف الفردي', { align: 'center', size: 28, bold: true, color: '775B24', after: 40 }),
    p('نظام أساس لإدارة الحضور والدوام · توقيت صنعاء (الجمهورية اليمنية)', { align: 'center', size: 18, color: '555555', after: 120 }),

    // Metadata Table
    table(
      ['اسم الموظف', 'الرقم الوظيفي', 'الفرع', 'الوردية', 'الفترة المحددة', 'تاريخ الإصدار'],
      [[
        { text: emp.name, bold: true },
        { text: emp.identifier, bold: true, color: '775B24' },
        emp.branch_name,
        emp.shift_name,
        `من ${from} إلى ${to}`,
        nowStr
      ]],
      [2200, 1200, 1600, 1600, 1600, 1438]
    ),

    p('', { after: 100 }),

    // Statistical Summary Grid
    table(
      ['أيام الدوام المستحقة', 'أيام الحضور الفعلي', 'أيام الغياب', 'مرات ودقائق التأخير', 'ساعات العمل الفعلية', 'الإجازات والعطلات', 'نسبة الالتزام'],
      [[
        `${sum.work_days} يوم`,
        { text: `${sum.present_days} يوم`, bold: true, color: '2D6A4F' },
        { text: `${sum.absent_days} يوم`, bold: sum.absent_days > 0, color: sum.absent_days > 0 ? 'B91C1C' : '221F20' },
        `${sum.late_days_count} (${sum.total_late_minutes} د)`,
        { text: `${sum.total_work_hours} س`, bold: true },
        `${sum.leave_days} إجازة / ${sum.weekend_days} عطلة`,
        { text: `${sum.attendance_rate}%`, bold: true, color: '775B24' }
      ]],
      [1400, 1400, 1200, 1500, 1400, 1500, 1238],
      '775B24'
    ),

    p('', { after: 100 })
  ];

  if (sum.incomplete_records_count > 0) {
    bodyParts.push(
      p(`⚠️ تنبيه إداري: يوجد ${sum.incomplete_records_count} سجلات بحاجة لمراجعة وتصحيح (سجل حضور بدون تسجيل انصراف أو العكس). لم يتم احتساب ساعات عمل افتراضية حرصاً على مصداقية السجلات.`, {
        align: 'right',
        size: 18,
        bold: true,
        color: 'B91C1C',
        after: 100
      })
    );
  }

  // Day-by-Day Historical Timeline
  const headers = ['التاريخ', 'اليوم', 'الدوام', 'وقت الدخول', 'وقت الخروج', 'الحالة', 'التأخير', 'ساعات العمل', 'ملاحظات وتنبيهات'];
  const rows = dossier.timeline.map(t => {
    let statusColor = '2D6A4F';
    if (t.state === 'absent') statusColor = 'B91C1C';
    else if (t.state === 'incomplete' || t.needs_review) statusColor = 'B91C1C';
    else if (t.state === 'late') statusColor = 'B45309';
    else if (t.state === 'leave') statusColor = '1D4ED8';
    else if (t.state === 'weekend') statusColor = '4B5563';

    const inTime = t.first_in ? new Date(t.first_in).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Aden' }) : (t.state === 'absent' ? 'لم يسجل' : '—');
    const outTime = t.last_out ? new Date(t.last_out).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Aden' }) : (t.state === 'inside' ? 'حاضر الآن' : '—');

    return [
      t.date,
      t.day_name,
      t.is_workday ? (emp.shift_name || 'دوام رسمي') : 'عطلة أسبوعية',
      { text: inTime, bold: Boolean(t.first_in), color: t.first_in ? '2D6A4F' : '221F20' },
      outTime,
      { text: t.status_label, bold: true, color: statusColor },
      t.late_minutes > 0 ? `${t.late_minutes} د` : '—',
      { text: `${t.work_hours || '0.0'} س`, bold: Number(t.work_hours) > 0 },
      { text: t.needs_review ? '⚠️ يحتاج مراجعة' : (t.exit_reason_label || (t.is_weekend ? 'راحة أسبوعية' : '—')), color: t.needs_review ? 'B91C1C' : '555555' }
    ];
  });

  bodyParts.push(table(headers, rows, [1200, 1000, 1200, 1100, 1100, 1500, 800, 850, 888]));

  return createDocxFromTemplate(bodyParts.join(''));
}

/**
 * Generates official branded .docx report for the collective summary of all employees.
 */
function generateCollectiveSummaryDocx(report, from, to) {
  const nowStr = new Date().toLocaleString('ar-YE', { timeZone: 'Asia/Aden' });
  const ov = report.overall;

  const bodyParts = [
    p('التقرير الجماعي الشامل للحضور والانصراف', { align: 'center', size: 28, bold: true, color: '775B24', after: 40 }),
    p('نظام أساس لإدارة الحضور والدوام · توقيت صنعاء (الجمهورية اليمنية)', { align: 'center', size: 18, color: '555555', after: 120 }),

    // Overall stats table
    table(
      ['الفترة المحددة', 'إجمالي الموظفين', 'أيام الحضور', 'أيام الغياب', 'التأخيرات', 'ساعات العمل', 'متوسط الالتزام'],
      [[
        `من ${from} إلى ${to}`,
        { text: `${ov.total_employees} موظف`, bold: true },
        { text: `${ov.total_present_days} يوم`, bold: true, color: '2D6A4F' },
        { text: `${ov.total_absent_days} يوم`, bold: ov.total_absent_days > 0, color: ov.total_absent_days > 0 ? 'B91C1C' : '221F20' },
        `${ov.total_late_days} (${ov.total_late_minutes} د)`,
        { text: `${ov.total_work_hours} س`, bold: true },
        { text: `${ov.average_attendance_rate}%`, bold: true, color: '775B24' }
      ]],
      [1800, 1300, 1300, 1300, 1400, 1300, 1238],
      '775B24'
    ),

    p('', { after: 120 })
  ];

  const headers = ['الرقم الوظيفي', 'اسم الموظف', 'الفرع', 'الوردية', 'حضور', 'غياب', 'التأخير', 'ساعات العمل', 'الإجازات', 'نسبة الالتزام'];
  const rows = report.employees.map(e => [
    { text: e.identifier, bold: true, color: '775B24' },
    { text: e.name, bold: true, align: 'right' },
    e.branch_name,
    e.shift_name,
    { text: `${e.present_days} يوم`, color: '2D6A4F', bold: true },
    { text: `${e.absent_days} يوم`, color: e.absent_days > 0 ? 'B91C1C' : '221F20' },
    e.late_days_count > 0 ? `${e.late_days_count} (${e.total_late_minutes} د)` : 'في الموعد',
    { text: `${e.total_work_hours} س`, bold: true },
    `${e.leave_days}`,
    { text: `${e.attendance_rate}%`, bold: true, color: e.attendance_rate >= 80 ? '2D6A4F' : 'B45309' }
  ]);

  bodyParts.push(table(headers, rows, [1100, 1800, 1300, 1300, 800, 800, 1100, 950, 700, 788]));

  return createDocxFromTemplate(bodyParts.join(''));
}

/**
 * Generates official branded .docx report for general duty movements.
 */
function generateDutyRecordsDocx(rows, from, to) {
  const nowStr = new Date().toLocaleString('ar-YE', { timeZone: 'Asia/Aden' });

  const bodyParts = [
    p('تقرير حركات الحضور والانصراف التفصيلية', { align: 'center', size: 28, bold: true, color: '775B24', after: 40 }),
    p('نظام أساس لإدارة الحضور والدوام · توقيت صنعاء (الجمهورية اليمنية)', { align: 'center', size: 18, color: '555555', after: 120 }),

    table(
      ['الفترة المحددة', 'إجمالي الحركات', 'تاريخ ووقت الإصدار'],
      [[`من ${from} إلى ${to}`, `${rows.length} حركة مسجلة`, nowStr]],
      [3200, 3200, 3238],
      '775B24'
    ),

    p('', { after: 120 })
  ];

  const headers = ['الرقم', 'الموظف', 'الفرع', 'تاريخ الدوام', 'وقت الدخول', 'وقت الخروج', 'الحالة', 'سبب الخروج', 'الدقائق'];
  const tableRows = rows.map(r => {
    const isInside = r.state === 'inside';
    const isAbsent = r.state === 'absent';
    const inTime = r.first_in ? new Date(r.first_in).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Aden' }) : (isAbsent ? 'لم يحضر' : '—');
    const outTime = r.last_out ? new Date(r.last_out).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Aden' }) : (isInside ? 'حاضر الآن' : '—');

    return [
      r.identifier,
      { text: r.name, bold: true, align: 'right' },
      r.branch_name,
      r.shift_start ? new Date(r.shift_start).toLocaleDateString('ar-YE', { timeZone: 'Asia/Aden' }) : '—',
      { text: inTime, bold: Boolean(r.first_in), color: r.first_in ? '2D6A4F' : (isAbsent ? 'B91C1C' : '221F20') },
      outTime,
      { text: r.status_label || (isInside ? 'حاضر الآن' : (isAbsent ? 'غائب' : 'تم الانصراف')), bold: true },
      r.exit_reason_label || '—',
      `${r.counted_minutes || 0} د`
    ];
  });

  bodyParts.push(table(headers, tableRows, [900, 1700, 1200, 1100, 1100, 1100, 1200, 1300, 838]));

  return createDocxFromTemplate(bodyParts.join(''));
}

module.exports = {
  generateEmployeeDossierDocx,
  generateCollectiveSummaryDocx,
  generateDutyRecordsDocx
};
