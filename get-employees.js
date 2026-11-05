const db = require('./backend/src/config/database');

async function getEmployees() {
  const res = await db.query(`
    SELECT a.id, a.identifier, a.name, a.role, a.phone, a.email, a.active,
           COALESCE(b.name, 'الفرع الرئيسي') as branch_name,
           COALESCE(s.name, 'الوردية الصباحية') as shift_name,
           COALESCE(d.name, 'عام') as department_name
    FROM accounts a
    LEFT JOIN branches b ON a.branch_id = b.id
    LEFT JOIN shifts s ON a.shift_id = s.id
    LEFT JOIN departments d ON a.department_id = d.id
    ORDER BY a.id ASC
  `);

  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}

getEmployees().catch(e => {
  console.error(e);
  process.exit(1);
});
