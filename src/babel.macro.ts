import { createMacro } from 'babel-plugin-macros';

module.exports = createMacro(({ babel: { template, types }, references }) => {
  references.default.forEach(({ parentPath }) => {
    parentPath;
  });
});
