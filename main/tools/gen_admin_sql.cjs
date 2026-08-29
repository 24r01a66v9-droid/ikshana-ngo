const bcrypt = require('bcryptjs');

const [,, email, password, name='Admin'] = process.argv;
if (!email || !password) {
  console.error('Usage: node gen_admin_sql.cjs <email> <password> [name]');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);

const sql = `-- SQL to create or update admin user\nINSERT INTO users (name, email, password, role) VALUES ('${name.replace(/'/g, "''")}', '${email.replace(/'/g, "''")}', '${hash}', 'admin')\nON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, role = 'admin', name = EXCLUDED.name;`;

console.log(sql);
