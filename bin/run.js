#!/usr/bin/env -S node --no-warnings
// AIDEV-NOTE: --no-warnings를 설정하여 oclif topic discovery 시 발생하는
// "command <topic> not found" Node.js process warning을 억제한다.
// 이 warning은 topic에 대응하는 직접 커맨드가 없을 때 발생하며 기능에 영향 없다.
// process.emitWarning을 noop으로 덮어쓰는 이유: `node bin/run.js`로 실행 시 shebang이 무시되어
// --no-warnings가 적용되지 않기 때문.
process.emitWarning = () => {};
import { execute } from "@oclif/core";
await execute({ dir: import.meta.url });
