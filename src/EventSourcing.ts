export module EventSourcing { 
    export type Success = {
        success: true;
        newEvents: IEvent[];
        newState: IReadModel;
    }
    
    export type Failure = {
        success: false,
        invalid: IInvalidCommand[]
    }
    
    export type SuccessOrFailure = Success | Failure;
    
    export interface IKeyedSet<T> {
        [name: string]: T[];
    }
    
    export interface IReadModel {
        $type: string;
        id: string;
        $version: number;
    }
    
    export interface IEvent {
        $type: string;
        id: string;
        $version: number;
    }
    
    export interface ICommand {
        $type: string;
        id: string;
        $version?: number;
    }
    
    export interface IInvalidCommand {
        /** Machine friendly type identifier for this error message, use useful for finding a local translation or handling the error in some programatic way */
        $type: string;
    
        /** The command the user asked to be performed */
        $command: ICommand;
    
        /** User friendly error message about what was wrong about the command */
        message: string;
    }
    
    export type Validator = (state: IReadModel, command: ICommand) => IInvalidCommand;
    export type Executor = (state: IReadModel, command: ICommand) => IEvent[];
    export type Handler = (state: IReadModel, event: IEvent) => IReadModel;
    export type Aggregator = (left: IReadModel, right: IReadModel) => IReadModel;
    export type ExecutionContext =  IReadModel | IEvent[] | null;

    function pushAll<T>(items: T[], newItems: T[]) {
        for (let i of newItems) {
            items.push(i);
        }
    }

    export class Aggregate {
        constructor(
            public validators: IKeyedSet<Validator>,
            public executors: IKeyedSet<Executor>,
            public handlers: IKeyedSet<Handler>) {    
        }

        public execute(context: IEvent[] | IReadModel, commands: ICommand[]): SuccessOrFailure {
            let success: IEvent[] = [];
            let failure: IInvalidCommand[] = [];
            let currentState: IReadModel = typeof context["$type"] !== 'undefined' ? 
                context as IReadModel :
                this.buildState(null, context as IEvent[] || []);
            let version = !!currentState ? currentState.$version : 0;
            commands.forEach(command => {
                if (failure.length != 0) {
                    return;
                }

                (this.validators[command.$type] || [])
                    .forEach(validator => {
                        var invalid = validator(currentState, command);
                        if (invalid != null) {
                            failure.push(invalid);
                        }
                    });

                if (failure.length != 0) {
                    return;
                }

                (this.executors[command.$type] || [])
                    .forEach(executor => {
                        let newEvents = executor(currentState, command);
                        newEvents.forEach(newEvent => {
                            newEvent.id = command.id;
                            newEvent.$version = ++version;
                            success.push(newEvent);
                        });

                        currentState = this.buildState(currentState, newEvents);
                    });            
            });

            if (failure.length != 0) {
                return { success: false, invalid: failure };
            }

            return { success: true, newEvents: success, newState: currentState };
        }

        private buildState(currentState: IReadModel, events: IEvent[]): IReadModel {
            events.forEach(event => {
                (this.handlers[event.$type] || []).forEach(handler => {
                    currentState = handler(currentState, event);
                    currentState.$version = event.$version;
                });
            });

            return currentState;
        }
    }


    export class Command implements ICommand {
        constructor(public $type: string, public id: string) {
        }
    }

    export class DomainEvent implements IEvent {
        id: string;
        $version = 0;

        constructor(public $type: string, idOrCommand: string | ICommand) {
            if (typeof (idOrCommand) === 'string') {
                this.id = idOrCommand;
            } else {
                this.mapCommonProperties(idOrCommand);
            }
        }

        private mapCommonProperties(command: ICommand) {        
            Object.getOwnPropertyNames(command).forEach(commandProperty => {
                if (commandProperty[0] !== '$' && typeof Object.getOwnPropertyDescriptor(this, commandProperty) !== 'undefined') {
                    this[commandProperty] = command[commandProperty];
                }
            })
        }
    }
}