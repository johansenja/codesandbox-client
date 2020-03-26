import { IBoilerplate } from '.';

export const JS: IBoilerplate = {
  extension: '.js',
  condition: p => /\.jsx?$/.test(p),
  code: `
import React from 'react';
import { render } from 'react-dom';
export default function(module) {
  const node = document.createElement('div');
  document.body.appendChild(node);
  render(React.createElement(module.default), node);
}
`,
};

export const HTML: IBoilerplate = {
  extension: '.html',
  condition: p => p.endsWith('.html'),
  code: `
export default function(module) {
  document.body.innerHTML = module
}
`,
};

export const TS: IBoilerplate = {
  extension: '.ts',
  condition: p => /\.tsx?$/.test(p),
  code: `
import * as React from 'react';
import { render } from 'react-dom';
export default function(module) {
  const node = document.createElement('div');
  document.body.appendChild(node);
  render(React.createElement(module.default), node);
}
`,
};

export default [JS, HTML, TS];
