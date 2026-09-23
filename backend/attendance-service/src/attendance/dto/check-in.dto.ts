import { LocationEventDto } from './location-event.dto';

/** Same shape as every location-carrying attendance event (spec §9). */
export class CheckInDto extends LocationEventDto {}
