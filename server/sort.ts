import * as dotenv from 'dotenv';
// eslint-disable-next-line angular/module-getter
dotenv.config();

interface SortQueueItem {
  userId: string;
  nextRun: number;
}

import { DataStore } from './lib/data-store';
import { SortLists } from './lib/sort';


class SortQueue {
  ds: DataStore;
  sortQueue: SortQueueItem[] = [];
  nextBatch: SortQueueItem[] = [];
  running = false;

  private processInterval = 60000;
  private timer: any;


  constructor() {
    this.ds = new DataStore('0');
  }

  public updateQueue = async () => {
    const autoSortUsers = await this.ds.getAutoSortUsers();
    const userList = autoSortUsers.map((u: any) => u.userId);
    const queueList = this.sortQueue.map((u: any) => u.userId);
    // Remove any user queued that has since turned off auto sort.
    this.sortQueue = this.sortQueue.filter(q => userList.indexOf(q.userId) !== -1);
    // Add any user that has since turned on auto sort.
    autoSortUsers.forEach((u: any) => queueList.indexOf(u.userId) === -1 ? this.sortQueue.push({ userId: <string>u.userId, nextRun: parseInt(u.lastRun, 10) + parseInt(u.autoSortInterval) }) : null);
    console.log(this.sortQueue);
  };

  private processNext = async () => {
    console.log('Processing sort queue...');
    clearTimeout(this.timer);

    await this.updateQueue();
    const nextBatchUsers = this.sortQueue.filter(s => Date.now() > s.nextRun).map(s => s.userId);
    nextBatchUsers.forEach(uid => {
      const ix = this.sortQueue.findIndex(s => s.userId === uid);
      this.nextBatch.push(this.sortQueue.splice(ix)[0]);
    });
    console.log(`${this.sortQueue.length} Users using Auto Sort.`);
    console.log(`${this.nextBatch.length} Users using will run in the next batch.`);
    this.sort();

    
  };

  private sort = () => {
    if (this.nextBatch.length === 0) {
      console.log('Finished running the current batch.');
      clearTimeout(this.timer);
      this.timer = setTimeout(() => this.processNext(), this.processInterval);
      return;
    }
      
    const userId = this.nextBatch.pop()?.userId || '';
    const sort = new SortLists(userId);
    console.log(`Processing user: ${userId}`);
    sort.loadAndSort().catch(e => {
      console.log(`Error sorting for user: ${userId}:`, e);
      this.sort();
    }).then(() => this.sort());
  };

  public startService(interval?: number) {
    this.processInterval = interval || this.processInterval;
    console.log('Starting autoSort Service.');
    console.log(`Processing queue every ${String(this.processInterval/60000)} minutes.`);
    this.sort();
  }

}

const sq = new SortQueue();
sq.startService();
