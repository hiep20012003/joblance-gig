const shell = require('shelljs');

// Copy templates
shell.cp('-R', 'src/seed', 'build/seed');
