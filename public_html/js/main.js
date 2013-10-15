function SharedResourceController (resourceName) {
    var now = Date.now(),
        ping = 0;
    this.resourceName = resourceName;
    this.intercom = Intercom.getInstance();
    try {
        ping = +localStorage.getItem( 'ping' ) || 0;
    } catch ( error ) {}
    if ( now - ping > 45000 ) {
        this.becomeMaster();
    } else {
        this.loseMaster();
    }
    window.addEventListener( 'storage', this, false );
    window.addEventListener( 'unload', this, false );
}

SharedResourceController.prototype.hasResource = false;
SharedResourceController.prototype.destroy = function () {
    if ( this.hasResource ) {
        try {
            localStorage.setItem( 'ping', 0 );
        } catch ( error ) {}
    }
    window.removeEventListener( 'storage', this, false );
    window.removeEventListener( 'unload', this, false );
    this.intercom.destroy();
};

SharedResourceController.prototype.handleEvent = function ( event ) {
    if ( event.type === 'unload' ) {
        this.destroy();
    } else {
        var type = event.key,
            ping = 0,
            data;
        if ( type === 'ping' ) {
            try {
                ping = +localStorage.getItem( 'ping' ) || 0;
            } catch ( error ) {}
            if ( ping ) {
                this.loseMaster();
            } else {
                // We add a random delay to try avoid the race condition in
                // Chrome, which doesn't take out a mutex on local storage. It's
                // imperfect, but will eventually work out.
                clearTimeout( this._ping );
                this._ping = setTimeout(
                    this.becomeMaster.bind( this ),
                    ~~( Math.random() * 1000 )
                );
            }
        } else if ( type === 'broadcast' ) {
            try {
                data = JSON.parse(
                    localStorage.getItem( 'broadcast' )
                );
                this[ data.type ]( data.event );
            } catch ( error ) {}
        }
    }
};

SharedResourceController.prototype.becomeMaster = function () {
    try {
        localStorage.setItem( 'ping', Date.now() );
    } catch ( error ) {}

    clearTimeout( this._ping );
    this._ping = setTimeout( this.becomeMaster.bind( this ),
        20000 + ~~( Math.random() * 10000 ) );

    var hadResource = this.hasResource;
    this.hasResource = true;
    if ( !hadResource ) {
        this.masterDidChange();
    }
};

SharedResourceController.prototype.loseMaster = function () {
    clearTimeout( this._ping );
    this._ping = setTimeout( this.becomeMaster.bind( this ),
        35000 + ~~( Math.random() * 20000 ) );

    var hadResource = this.hasResource;
    this.hasResource = false;
    if ( hadResource ) {
        this.masterDidChange();
    }
};

SharedResourceController.prototype.masterDidChange = function () {
    if (this.hasResource) {
        $('#resource').text('true').css('color', 'green');
    } else {
        $('#resource').text('false').css('color', 'red');
    }
};

SharedResourceController.prototype.broadcast = function ( type, event ) {
    try {
        localStorage.setItem( 'broadcast',
            JSON.stringify({
                type: type,
                event: event
            })
        );
    } catch ( error ) {}
};

SharedResourceController.prototype.on = function ( name, fn ) {
    this.intercom.on(name, fn);
};

SharedResourceController.prototype.once = function ( name, fn, ttl ) {
    this.intercom.once(name, fn, ttl);
};

SharedResourceController.prototype.emit = function ( name, message ) {
    this.intercom.emit(name, message);
};

var controller = new SharedResourceController();

var num_of_messages = 0;

controller.on('text', function(data) {
    if (num_of_messages % 10 === 0) {
        num_of_messages = 0;
        $('#messages').empty();
    }
    num_of_messages++;
    $('#messages').append('<p>'+data.message+'</p>');
});

setInterval(function(){
    if (controller.hasResource) {
        controller.emit('text', {message: 'Message'});
    }
}, 1000);