import { JanusClient } from '@vtex/api'
import type { InstanceOptions, IOContext } from '@vtex/api'

const VERSION = 4

const routes = {
  getQueueSchedule: (workspace: string, account: string) =>
    `/api/scheduler/${workspace}/${account}/b2b-quotes-queue-schedule?version=${VERSION}`,
  getSyncSchedule: (workspace: string, account: string) =>
    `/api/scheduler/${workspace}/${account}/b2b-quotes-sync-schedule?version=${VERSION}`,
  scheduler: (workspace: string, account: string) =>
    `/api/scheduler/${workspace}/${account}?version=${VERSION}`,
}

export class Scheduler extends JanusClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super(ctx, {
      ...options,
      headers: {
        ...options?.headers,
        VtexIdclientAutCookie: ctx.authToken,
      },
    })
  }

  public createOrUpdate = (scheduler: any) => {
    return this.http.put(
      routes.scheduler(this.context.workspace, this.context.account),
      scheduler,
      {
        metric: 'b2b-quotes-scheduler-createupdate',
      }
    )
  }

  public getQueue = () => {
    return this.http.get(
      routes.getQueueSchedule(this.context.workspace, this.context.account),
      {
        metric: 'b2b-quotes-scheduler-get',
      }
    )
  }

  public deleteQueue = () => {
    return this.http.delete(
      routes.getQueueSchedule(this.context.workspace, this.context.account),
      {
        metric: 'b2b-quotes-scheduler-delete',
      }
    )
  }

  public getSync = () => {
    return this.http.get(
      routes.getSyncSchedule(this.context.workspace, this.context.account),
      {
        metric: 'b2b-quotes-scheduler-get',
      }
    )
  }

  public deleteSync = () => {
    return this.http.delete(
      routes.getSyncSchedule(this.context.workspace, this.context.account),
      {
        metric: 'b2b-quotes-scheduler-delete',
      }
    )
  }
}
