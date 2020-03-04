import { Module, PrettierConfig } from '@codesandbox/common/lib/types';
import prettify from 'app/utils/prettify';

type Options = {
  getPrettierConfig(): PrettierConfig;
  getCurrentModule(): Module | null;
};

let _options: Options;

export default {
  initialize(options: Options) {
    _options = options;
  },
  prettify(moduleId: string, title: string, code: string): Promise<string> {
    return prettify(
      title,
      () => code,
      _options.getPrettierConfig(),
      () => _options.getCurrentModule()?.id === moduleId
    );
  },
};
