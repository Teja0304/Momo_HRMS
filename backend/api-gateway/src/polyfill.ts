import * as util from 'util';

// Fix DEP0060 deprecation warning emitted by Node 22+ for legacy http-proxy dependencies
if (typeof (util as any)._extend === 'function') {
  (util as any)._extend = Object.assign;
}
