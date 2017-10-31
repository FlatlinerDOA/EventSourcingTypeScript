
import {EventSourcing} from './EventSourcing';
import {EphemeralStorage} from './EphemeralStorage';
module Users {
    const $namespace = "Users";

    export class UserAlreadyExists implements EventSourcing.IInvalidCommand {
        $type = "UserAlreadyExists";
        constructor(
            public $command: EventSourcing.ICommand, 
            public message: string = "This cannot be created as it already exists") {        
        }
    }

    export class DisplayNameRequired implements EventSourcing.IInvalidCommand {
        $type = "DisplayNameRequired";
        constructor(
            public $command: EventSourcing.ICommand,
            public message: string = "Please provide a display name for this user") {        
        }
    }

    export class CreateUser extends EventSourcing.Command {        
        constructor(id: string, public password: string, public displayName: string) {
            super("CreateUser", id);
        }
    }

    export class UserCreated extends EventSourcing.DomainEvent {
        public displayName: string;
        public passwordHash: string;

        constructor(create: CreateUser, public passwordSalt: string) {
            super("UserCreated", create);
            this.passwordHash = create.password + passwordSalt;
        }
    }

    export class User implements EventSourcing.IReadModel {
        $type = "User";
        id: string;
        $version = 0;

        constructor(created: UserCreated) {
            this.id = created.id;
            this.$version = created.$version;
        }
    }

    export const aggregate = new EventSourcing.Aggregate(
        {
            "CreateUser": [
                (state: User, create: CreateUser) => state != null ? new UserAlreadyExists(create) : null, 
                (state: User, create: CreateUser) => (create.displayName || '').trim().length == 0 ? new DisplayNameRequired(create) : null, 
            ]
        },
        {
            "CreateUser": [
                (state: User, create: CreateUser) => [new UserCreated(create, "somesalt")]
            ]
        },
        {
            "UserCreated": [
                (state: User, created: UserCreated) => new User(created)
            ]
        });
}


async function TestCreaate() {
    let commands = [
        new Users.CreateUser("frank@stevens.com", "mysecretpassword", "Franky Stevens")
    ];

    let eventStore = new EphemeralStorage.EventStore("Dev", "Estimate");
    let stateStore = new EphemeralStorage.ReadModelStore("Dev", "Estimate");

    let aggregateEvents = await eventStore.getByIdAsync(commands[0].id);

    var result = Users.aggregate.execute(aggregateEvents, commands);
    if (result.success) {
        await eventStore.addEventsAsync(result.newEvents);
        await stateStore.storeAsync(result.newState);
    }

    return result;
}

TestCreaate().then(result => console.log(result));
TestCreaate().then(result => console.log(result));
