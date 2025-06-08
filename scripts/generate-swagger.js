const fs = require('fs');
const swagger = require('../swagger/swagger.js');
fs.writeFileSync(
  'swagger.json',
  JSON.stringify(swagger, null, 2),
  'utf8'
);
console.log('✨ swagger.json generado');
