import { EventEmitter } from 'events';

class AppEventBus extends EventEmitter {}
const bus = new AppEventBus();
bus.setMaxListeners(100);

export default bus;
