import {EventSourcing} from './EventSourcing';
export module EphemeralStorage {
    let allStores = {
    };
    
    export class EventStore {
        store: any;

        constructor(environment: string, domain: string) {
            var key = environment + '_' + domain + '_events';
            this.store = allStores[key] || {};
            allStores[key] = this.store;
        }

        async getByIdAsync(id: string): Promise<EventSourcing.IEvent[]> {
            return this.store[id] || [];
        }

        async addEventsAsync(newEvents: EventSourcing.IEvent[]) {
            for (let ev of newEvents) {
                var evts = this.store[ev.id] || [];
                let latestVersion = (evts.length !== 0 ? evts[evts.length - 1].$version : 0);
                if (ev.$version !== latestVersion + 1) {
                    throw new Error("Concurrency error!");
                }

                evts.push(ev);
                this.store[ev.id] = evts;
            }
        }
    }

    export class ReadModelStore {
        store: any;
        constructor(environment: string, domain: string, schemaRevision: number = 0) {                    
            var key = environment + '_' + domain + '_rm_' + schemaRevision;
            this.store = allStores[key] || {};
            allStores[key] = this.store;
        }

        async getByIdAsync(id: string): Promise<EventSourcing.IReadModel> {
            return this.store[id] || null;
        }

        async storeAsync(item: EventSourcing.IReadModel): Promise<void> {
            if (!item) {
                return;
            }

            var existing = this.store[item.id] || null;
            if (!existing || existing.$version < item.$version) {
                this.store[item.id] = item;
            }
        }
    }
}
