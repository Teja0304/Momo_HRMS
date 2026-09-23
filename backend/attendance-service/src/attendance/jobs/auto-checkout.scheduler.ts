import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AppConfig } from '../../config/configuration';
import { AttendanceService } from '../services/attendance.service';

/**
 * Runs on a cron schedule (default every minute, see AUTO_CHECKOUT_CRON)
 * and finds every PAUSED session whose currentGraceDeadline has passed,
 * closing each one out. This is a timestamp comparison against the DB,
 * never a per-second in-memory timer — see spec §13.
 *
 * Registered manually via SchedulerRegistry (rather than @Cron()) so the
 * cron expression stays configurable through AUTO_CHECKOUT_CRON without
 * a code change.
 */
@Injectable()
export class AutoCheckoutScheduler {
  private readonly logger = new Logger(AutoCheckoutScheduler.name);

  constructor(
    private readonly attendanceService: AttendanceService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    const { cron, batchSize } = this.configService.get('autoCheckout', { infer: true });

    const job = new CronJob(cron, () => {
      this.runSweep(batchSize).catch((error) => {
        this.logger.error(`Auto-checkout sweep crashed: ${(error as Error).message}`);
      });
    });

    this.schedulerRegistry.addCronJob('auto-checkout-sweep', job);
    job.start();
    this.logger.log(`Auto-checkout scheduler started (cron="${cron}", batchSize=${batchSize})`);
  }

  private async runSweep(batchSize: number): Promise<void> {
    await this.attendanceService.runAutoCheckoutSweep(batchSize, new Date());
  }
}
