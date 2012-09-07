Parse.initialize("XIlSlR5qyUd1YqBGe12gaqWTrXOrqx6NvTo2Vfet", "mfDi9u687DNFpiNQgfgSRHf9cUy0bHr8HJZU1lfy");
window.pusher = new Pusher('86fffff978d340e26797');
window.pusher.subscribe_async = function(key, callback) {
    if (window.pusher.connection.state != "connected") {
        window.pusher.connection.bind('connected', function() {
          callback(window.pusher.subscribe(key));
        });
    }
    else {
        callback(window.pusher.subscribe(key));
    }
}

window.AppDataCollectionMethods = {
    columns: function(full) {
        full = _.isUndefined(full) ? false : true;
        var columns = [];
        this.each(function(object) {
            for(var columnName in object.toJSON()) {
                if (!_.include(columns, columnName)) {
                    columns.push(columnName);
                }
            }
        });
        if (full) {
            _.each(["id", "createdAt", "updatedAt"], function(property) {
                columns.push(property);
            });
        }

        return columns;
    },
    columnsWithValues: function() {
        var that = this;
        var rows = [];
        this.each(function(model) {
            var entries = [];
            _.each(that.columns(), function(column, index) {
                var data = model.get(column);
                if (_.isUndefined(data) || _.isNull(data)) {
                    data = "N/A"
                }
                entries.push(data);
            });
            rows.push(entries);
        });
        return rows;
    },
    comparator: function(object1, object2) {
        var bool = object1.createdAt > object2.createdAt;
        if (object1.createdAt == object2.createdAt)
            return 0
        else if (object1.createdAt > object2.createdAt)
            return -1
        return 1;
    }
}

window.ParseForm = Parse.Object.extend({
    className: "ParseForm",
    appDataKey: function() { return "APPTORY_DATA_" + this.id },
    AppData: function() {
        if (_.isUndefined(this._appData)) {
            this._appData = Parse.Object.extend(this.appDataKey());
        }
        return this._appData;
    },
    AppDataCollection: function() {
        if (typeof this._appDataCollection === "undefined") {
            // Shallow copy
            var methods = _.extend(_.clone(window.AppDataCollectionMethods), {model: this.AppData()});
            this._appDataCollection = Parse.Collection.extend(methods);
        }
        return this._appDataCollection;
    },
    fetchAppData: function(callback_params) {
        var that = this;
        window.appDataCollection = new (this.AppDataCollection())();
        window.appDataCollection.fetch({
            success: function(collection) {
                callback_params.success(collection);
                that.listenForChanges();
            },
            error: function(object, error) {
                callback_params.error(object, error);
            }
        });
    },
    stopListening: function() {
        if (pusher.channel(this.appDataKey())) {
            window.pusher.unsubscribe(this.appDataKey());
        }
    },
    listenForChanges: function() {
        var that = this;
        if (!pusher.channel(this.appDataKey())) {
            window.pusher.subscribe_async(this.appDataKey(), function(channel) {
                that.channel = channel;
                that.channel.bind('new_data', function(data) {
                    // Refresh the collection
                    if (!_.isUndefined(window.appDataCollection)) {
                        window.appDataCollection.fetch();
                    }
                });
            });
        }
    }
});

window.ParseFormCollection = Parse.Collection.extend({
    model: ParseForm,
});

window.AppDataRowCellView = Parse.View.extend({
    tagName: "td",
    template: _.template($('#app_data_column_template').html()),
    render: function() {
        $(this.el).html(this.template({data: this.model}));
        return this;
    }
})

window.AppDataRowView = Parse.View.extend({
    tagName: "tr",
    render: function() {
        var that = this;
        _.each(window.appDataCollection.columns(), function(column) {
            var data = that.model.get(column);
            if (_.isUndefined(data) || _.isNull(data)) {
                data = "N/A"
            }
            var cellView = new window.AppDataRowCellView({model: data}).render().el;
            that.$el.append(cellView);
        });
        _.each(["createdAt"], function(property) {
            var data = moment(that.model[property]);
            var cellView = new window.AppDataRowCellView({model: data.format('MMM D YYYY h:mm A')}).render().el;
            that.$el.append(cellView);
        });
        return this;
    }
});

window.AppDataHeaderCellView = Parse.View.extend({
    tagName: "td",
    template: _.template($('#app_data_column_header_template').html()),
    render: function() {
        $(this.el).html(this.template({data: this.model}));
        return this;
    }
});

window.AppDataHeaderView = Parse.View.extend({
    tagName: "tr",
    render: function() {
        var that = this;
        _.each(window.appDataCollection.columns().concat("createdAt"), function(column) {
            var cellView = new window.AppDataHeaderCellView({model: column}).render().el;
            that.$el.append(cellView);
        });
        return this;
    }
});

window.AppDataListView = Parse.View.extend({
    el: "#app_data_list",
    initialize: function() {
        _.bindAll(this, 'render');
        this.model.on("reset", this.render);
    },
    render: function() {
        var that = this;
        $(this.el).html("");
        var headerView = new window.AppDataHeaderView().render().el;
        //console.warn($(this.el));
        $(this.el).append(headerView);
        this.model.each(function(appData) {
            var dataView = new window.AppDataRowView({model:appData}).render().el;
            $(that.el).append(dataView);
        });
        return this;
    },
    remove: function() {
        $(this.el).empty();
        return this;
    },
});

window.AppView = Parse.View.extend({
    render: function() {
        var template = _.template($("#app_template").html(), {
            title: this.model.get('title')
        });
        this.$el.html(template);
        return this;
    },
    renderAppData: function() {
        this.model.fetchAppData({
            success: function(collection) {
                window.appDataListView = new window.AppDataListView({model: collection}).render();
            },
            error: function(object, error) {
                // ruh roh
            }
        });
    },
    remove: function() {
        $(this.el).empty();
        this.model.stopListening();
        window.appView = null;
        return this;
    },
    el: $("#app_container")
});

window.AppsListRow = Parse.View.extend({
    tagName: "li",
    className: "app-list-row",
    events: {
        "click": "openApp"
    },
    render: function() {
        $(this.el).html(this.model.get("title"));
        return this;
    },
    openApp: function(event) {
        var query = new Parse.Query(window.ParseForm);
        query.get(this.model.id, {
          success: function(parseForm) {
            // The object was retrieved successfully.
            window.activeForm = parseForm;
            window.appView = new window.AppView({model: parseForm}).render();
            window.appView.renderAppData();
            //window.appView.render();
          },
          error: function(object, error) {
            // The object was not retrieved successfully.
            // error is a Parse.Error with an error code and description.
            console.warn("ERROR");
            console.warn(object);
          }
        });
    }
})

window.AppsListView = Parse.View.extend({
    initialize: function() {
        _.bindAll(this, 'render');
        return this;
    },
    render: function() {
        console.log(this.model);
        var that = this;
        _.each(this.model, function(app) {
            var appView = new window.AppsListRow({model:app}).render().el;
            $(that.el).append(appView);
        });
        return this;
    },
    el: "#apps-list"
});

window.AppsView = Parse.View.extend({
    initialize: function() {
        this.is_listening = false;
        this.render();
        return this;
    },
    render: function() {
        var template = _.template($("#apps-template").html());
        $(this.el).html(template);
        return this;
    },
    renderApps: function() {
        var relation = window.currentUser.relation("apps");
        var that = this;
        relation.query().find({
            success: function(collection) {
                window.appsListView = new window.AppsListView({model: collection}).render();
                that.listenForChanges();
            }
        });
    },
    pusherKey: function() {return "USER_FORMS_" + window.currentUser.id},
    stopListening: function() {
        if (this.subscribe_key && pusher.channel(this.subscribe_key)) {
            window.pusher.unsubscribe(this.subscribe_key);
            delete this.subscribe_key
        }
    },
    listenForChanges: function() {
        if (!pusher.channel(this.pusherKey())) {
            var that = this;
            this.subscribe_key = this.pusherKey();
            window.pusher.subscribe_async(this.subscribe_key, function(channel) {
                that.channel = channel;
                that.channel.bind('refresh', function(data) {
                    // Refresh the collection
                    $(this.el).empty();
                    that.render();
                    that.renderApps();
                });
            });
        }
    },
    remove: function() {
        $(this.el).empty();
        this.stopListening();
        window.appsView = null;
        return this;
    },
    el: "#apps-container"
});

window.LoginErrorView = Parse.View.extend({
    initialize: function() {
        this.render();
        return this;
    },
    render: function() {
        var template = _.template($("#login-error-template").html(), {
            data: this.model
        });
        window.loginView.$el.prepend(template);
    },
    remove: function() {
        $('#error-alert').empty().remove();
        return this;
    },
});

window.UserView = Parse.View.extend({
    initialize: function() {
        this.model = window.currentUser;
        this.render();
        return this;
    },
    events: {
        "click input[type=button]": "doLogout"
    },
    render: function() {
        var template = _.template($("#user-template").html(), {email: this.model.get("email")});
        $(this.el).html(template);
        return this;
    },
    doLogout: function(event) {
        Parse.User.logOut();
        window.currentUser = Parse.User.current();
        window.userInfoView.showLoginView();
    },
    remove: function() {
        $('#user-view').empty().remove();
        window.userView = null;
        return this;
    }
});

window.LoginView = Parse.View.extend({
    template: _.template($('#login-template').html()),
    render: function() {
        $(this.el).html(this.template({data: this.model}));
    },
    initialize: function() {
        this.render();
        return this;
    },
    render: function() {
        $(this.el).html(this.template);
        return this;
    },
    events: {
        "click #login-button": "doLogin",
    },
    disable: function() {
        $("#email-input").attr('disabled', true);
        $("#password-input").attr('disabled', true);
        $("#login-button").attr('disabled', true);
    },
    enable: function() {
        $("#email-input").removeAttr('disabled');
        $("#password-input").removeAttr('disabled');
        $("#login-button").removeAttr('disabled');
        if (!_.isUndefined(window.loginErrorView)) {
            window.loginErrorView.remove();
        }
    },
    doLogin: function(event) {
        console.log("HELLO");
        // Button clicked, you can access the element that was clicked with event.currentTarget
        if (window.appDataListView) {
            window.appDataListView.remove();
        }
        if (window.appView) {
            window.appView.remove();
        }
        this.disable();
        var email = $("#email-input").val();
        var password = $("#password-input").val();
        console.log("EMAIL " + email);
        var that = this;
        Parse.User.logIn(email, password, {
            success: function(user) {
                window.userInfoView.showUserView();
            },
            error: function(user, error) {
                that.enable();
                window.loginErrorView = new window.LoginErrorView({model: "Incorrect login."});
            }
        });
    },
    remove: function() {
        $('#login-form').empty().remove();
        window.loginView = null;
        return this;
    }
});

window.UserInfoView = Parse.View.extend({
    showLoginView: function() {
        if (window.userView) {
            window.userView.remove();
            window.appsView.remove();
        }
        if (window.appView) {
            window.appView.remove();
        }
        $(this.el).empty();
        $(this.el).append("<div id='login-view-container'></div>")
        window.loginView = new window.LoginView({el: '#login-view-container'});
    },
    showUserView: function() {
        console.log("hello.");
        window.currentUser = Parse.User.current();
        if (window.loginView) {
            window.loginView.remove();
        }
        $(this.el).empty();
        $(this.el).append("<div id='user-view-container'></div>")
        window.userView = new window.UserView({el: '#user-view-container'});
        window.appsView = new window.AppsView();
        window.appsView.renderApps();
    },
    el: "#user-info"
});

moment().format();
window.currentUser = Parse.User.current();
window.userInfoView = new window.UserInfoView();

if (window.currentUser) {
    window.userInfoView.showUserView();
}
else {
    window.userInfoView.showLoginView();
}