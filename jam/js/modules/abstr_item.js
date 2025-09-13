
import consts from "./consts.js";

class AbortError extends Error {
    constructor(message) {
        super(message);
        this.name = "AbortError";
    }
}

class AbsrtactItem {
    constructor(owner, ID, item_name, caption, visible, type, js_filename) {
        this.types = ["root", "users", "roles", "tasks", 'task',
            "items", "items", "details", "reports",
            "item", "item", "detail_item", "report", "detail"
        ];
        if (visible === undefined) {
            visible = true;
        }
        if (owner === undefined) {
            owner = null;
        }
        this.owner = owner;
        this.item_name = item_name || '';
        this.item_caption = caption || '';
        this.visible = visible;
        this.ID = ID || null;
        this.item_type_id = type;
        this.item_type = '';
        if (type) {
            this.item_type = this.types[type - 1];
        }
        if (js_filename) {
            this.js_filename = 'js/' + js_filename;
        }
        this.items = [];
        if (owner) {
            if (!owner.find(item_name)) {
                owner.items.push(this);
            }
            if (!(item_name in owner)) {
                owner[item_name] = this;
            }
            this.task = owner.task;
        }
    }

    get_master_field(fields, master_field) {
        var i = 0,
            len = fields.length;
        for (; i < len; i++) {
            if (fields[i].ID == master_field) {
                return fields[i];
            }
        }
    }

    each_item(callback) {
        var i = 0,
            len = this.items.length,
            value;
        for (; i < len; i++) {
            value = callback.call(this.items[i], this.items[i], i);
            if (value === false) {
                break;
            }
        }
    }

    all(func) {
        var i = 0,
            len = this.items.length;
        func.call(this, this);
        for (; i < len; i++) {
            this.items[i].all(func);
        }
    }

    find(item_name) {
        var i = 0,
            len = this.items.length;
        for (; i < len; i++) {
            if (this.items[i].item_name === item_name) {
                return this.items[i];
            }
        }
    }

    item_by_ID(id_value) {
        var result;
        if (this.ID === id_value) {
            return this;
        }
        var i = 0,
            len = this.items.length;
        for (; i < len; i++) {
            result = this.items[i].item_by_ID(id_value);
            if (result) {
                return result;
            }
        }
    }

    addChild(ID, item_name, caption, visible, type, js_filename, master_field) {
        var NewClass;
        if (this.getChildClass) {
            NewClass = this.getChildClass();
            if (NewClass) {
                return new NewClass(this, ID, item_name, caption,
                    visible, type, js_filename, master_field);
            }
        }
    }

    send_request(request, params, callback) {
        return this.task.process_request(request, this, params, callback);
    }

    init(info) {
        var i = 0,
            items = info.items,
            child,
            len = items.length,
            item_info;
        for (; i < len; i++) {
            item_info = items[i][1];
            child = this.addChild(item_info.id, item_info.name,
                item_info.caption, item_info.visible, item_info.type,
                item_info.js_filename, item_info.master_field);
            child._default_order = item_info.default_order;
            child._primary_key = item_info.primary_key;
            child._deleted_flag = item_info.deleted_flag;
            child._master_id = item_info.master_id;
            child._master_rec_id = item_info.master_rec_id;
            child.keep_history = item_info.keep_history;
            child.edit_lock = item_info.edit_lock;
            child._view_params = item_info.view_params;
            child._edit_params = item_info.edit_params;
            child._virtual_table = item_info.virtual_table;
            child.prototype_ID = item_info.prototype_ID
            child.master_applies = item_info.master_applies
            if (child.initAttr) {
                child.initAttr(item_info);
            }
            child.init(item_info);
        }
    }

    bind_items() {
        var i = 0,
            len = this.items.length;
        if (this._bind_item) {
            this._bind_item();
        }
        for (; i < len; i++) {
            this.items[i].bind_items();
        }
    }

    _check_args(args) {
        var i,
            result = {};
        for (i = 0; i < args.length; i++) {
            if (args[i] instanceof jQuery) {
                result['jquery'] = args[i]
            }
            else if (args[i] instanceof AbsrtactItem) {
                result['item'] = args[i]
            }
            else {
                result[typeof args[i]] = args[i];
            }
        }
        return result;
    }

    _file_loaded(js_filename) {
        for (let i = 0; i < document.scripts.length; i++) {
            let script = document.scripts[i].src.split('?')[0],
                file_name = js_filename.split('?')[0],
                arr1 = js_filename.split('/'),
                arr2 = script.split('/'),
                found = true;
            for (let j = 0;  j < arr1.length; j++) {
                if (arr1[arr1.length - 1 - j] !== arr2[arr2.length - 1 - j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return true;
            }
        }
    }

    load_script(js_filename, callback, onload) {
        var self = this,
            url,
            s0,
            s;
        if (js_filename && !this._file_loaded(js_filename)) {
            s = document.createElement('script');
            s0 = document.getElementsByTagName('script')[0];
            url = js_filename;

            s.src = url;
            s.type = "text/javascript";
            s.async = true;
            s0.parentNode.insertBefore(s, s0);
            s.onload = function() {
                if (onload) {
                    onload.call(self, self);
                }
                if (callback) {
                    callback.call(self, self);
                }
            };
        } else {
            if (callback) {
                callback.call(self, self);
            }
        }
    }

    load_module(callback) {
        this.load_modules([this], callback);
    }

    load_modules(item_list, callback) {
        var self = this,
            i = 0,
            len = item_list.length,
            item,
            list = [],
            mutex = 0,
            calcback_executing = false,
            load_script = function(item) {
                item.load_script(
                    item.js_filename,
                    function() {
                        if (--mutex === 0) {
                            if (callback && !calcback_executing) {
                                calcback_executing = true;
                                callback.call(self, self);
                            }
                        }
                    },
                    function() {
                        item.bind_handlers();
                    }
                );
            };
        for (; i < len; i++) {
            item = item_list[i];
            if (item.js_filename) list.push(item);
            if (item.details) {
                item.each_detail(function(d) {
                    if (d.js_filename) list.push(d);
                });
            }
        }
        len = list.length;
        mutex = len;
        if (len) {
            for (i = 0; i < len; i++) {
                load_script.call(list[i], list[i]);
            }
        } else {
            if (callback) {
                callback.call(this, this);
            }
        }
    }

    bind_handlers() {
        let events = task.events['events' + this.ID];
        if (this.master_field) {
            events = task.events['events' + this.prototype_ID];
        }
        this._events = [];
        for (var event in events) {
            if (events.hasOwnProperty(event)) {
                //~ if (this[event]) {
                    //~ console.error(this.item_name + ' client module ' + ': method "' +
                        //~ event + '" will override existing attribute. Please, rename the function.');
                //~ }
                this[event] = events[event];
                this._events.push([event, events[event]]);
            }
        }
    }

    bind_events() {
        var i = 0,
            len = this.items.length;

        this.bind_handlers();

        for (; i < len; i++) {
            this.items[i].bind_events();
        }
    }

    can_view() {
        return this.task.has_privilege(this, 'can_view');
    }

    _search_template(name, suffix) {
        var template,
            search = "." + name;
        if (suffix) {
            search = "." + name + "-" + suffix
        }
        template = task.templates.find(search);
        if (template.length) {
            return template;
        }
    }

    find_template(suffix, options) {
        var result,
            template,
            name,
            item = this;
        if (options.template_class) {
            template = this._search_template(options.template_class);
        }
        if (!template) {
            if (item.item_type === "detail") {
                template = this._search_template(item.owner.item_name + "-" + item.item_name, suffix);
                if (!template) {
                    template = this._search_template(item.owner.owner.item_name + "-details", suffix);
                }
                if (!template && options && options.buttons_on_top) {
                    template = this._search_template("default-top", suffix);
                }
                if (!template) {
                    template = this._search_template('default', suffix);
                }
                if (!template) {
                    item = item.owner;
                }
            }
            if (!template) {
                while (true) {
                    name = item.item_name;
                    template = this._search_template(item.item_name, suffix);
                    if (template) {
                        break;
                    }
                    item = item.owner;
                    if (item === item.task) {
                        break;
                    }
                }
            }
        }
        if (!template && options && options.buttons_on_top) {
            template = this._search_template("default-top", suffix);
        }
        if (!template) {
            template = this._search_template('default', suffix);
        }
        if (template) {
            result = template.clone();
        }
        else {
            this.warning(this.item_caption + ': ' +  suffix + ' form template not found.')
        }
        return result;
    }

    server(func_name, params) {
        var args = this._check_args(arguments),
            callback = args['function'],
            async = args['boolean'],
            res,
            err,
            result;
        if (params !== undefined && (params === callback || params === async)) {
            params = undefined;
        }
        if (params === undefined) {
            params = [];
        } else if (!$.isArray(params)) {
            params = [params];
        }
        if (callback || async) {
            this.send_request('server', [func_name, params], function(result) {
                res = result[0];
                err = result[1];
                if (callback) {
                    callback.call(this, res, err);
                }
                if (err) {
                    throw new Error(err);
                }
            });
        } else {
            result = this.send_request('server', [func_name, params]);
            res = result[0];
            err = result[1];
            if (err) {
                throw new Error(err);
            } else {
                return res;
            }
        }
    }

    _create_form_header(form, options, form_type, container) {
        let form_header,
            item_class;
        if (options.form_header) {
            form_header = $(
                '<div class="card-header form-header">' +
                    '<div class="form-header-title"></div>' +
                    '<div class="form-header-refresh-btn"></div>' +
                    '<div class="form-header-history-btn"></div>' +
                    '<div class="form-header-search-btn" style="display: none"></div>' +
                    '<div class="form-header-info-btn" style="display: none"></div>' +
                    '<div class="form-header-filters"></div>' +
                    //~ '<div class="form-header-print-btn"></div>' +
                    '<div class="form-header-close-btn"></div>' +
                '</div>'
            );
        }
        if (form_type) {
            if (this.master) {
                item_class = this.master.item_name + '-' + this.item_name + ' ' + form_type + '-form';
            }
            else {
                item_class = this.item_name + ' ' + form_type + '-form';
            }
        }
        let style_width = '';
        if (form_type != 'view') {
            if (!options.width) {
                options.width = 600;
            }
            if (container) {
                style_width = 'max-width:' + options.width + 'px;';
            }
        }
        let $form = $(
            '<div class="card ' + item_class + '" tabindex="-1" style="width:100%;' + style_width + '">' +
            '</div>'
        );
        if (options.form_header) {
            $form.append(form_header);
        }
        if (!options.form_border) {
            $form.addClass('no-border');
        }
        if (!container) {
            $form.addClass('modal-form');
        }
        this._set_form_options($form, options);
        $form.append(form);
        $form.addClass('jam-form');
        return $form;
    }

    _set_form_options(form, options, form_type) {
        var self = this,
            form_name = form_type + '_form',
            header = form.find('.form-header'),
            close_caption = '',
            close_button = '',
            print_caption = '',
            print_button = '',
            filter_count = 0,
            title = options.title,
            body;
        if (!title) {
            title = this.item_caption;
        }

        if (options.close_button) {
            close_button = '<button type="button" class="btn-close close-form-btn" tabindex="-1"></button>';
            header.find('.form-header-close-btn').html(close_button);
        }
        else {
            header.find('.form-header-close-btn').hide();
        }

        if (options.history_button && this.keep_history && task.history_item) {
            header.find('.form-header-history-btn')
                .html('<button type="button" class="btn btn-secondary history-btn"><i class="bi bi-film"></i></button>')
                .tooltip({placement: 'bottom', title: task.language.view_rec_history, trigger: 'hover'});
            header.find('.history-btn').css('cursor', 'default').click(function(e) {
                e.preventDefault();
                self.show_history();
            });
        }
        else {
            header.find('.history-btn').hide();
        }

        if (form_type !== 'view') {
            let $info = form.find('.field-help');
            if ($info.length) {
                header.find('.form-header-info-btn')
                    .show()
                    .html('<button type="button" class="btn btn-secondary info-btn" data-bs-toggle="button"><i class="bi bi-question-lg"></i></button>')
                    .tooltip({placement: 'bottom', title: task.language.info, trigger: 'hover'});
                header.find('.info-btn').css('cursor', 'default').click(function(e) {
                    e.preventDefault();
                    $info.toggleClass('active');
                    if ($info.hasClass('active')) {
                        $info.show();
                    }
                    else {
                        $info.hide();
                    }
                });
            }
        }

        if (form_type === 'view') {
            let $dbtable = form.find('.dbtable.' + this.item_name);
            if (options.enable_search && $dbtable.length) {
                header.find('.form-header-search-btn')
                    .html('<button type="button" class="btn btn-secondary search-btn">' +
                        '<i class="bi bi-search"></i>' +
                        '</button>')
                    .tooltip({placement: 'bottom', title: task.language.find, trigger: 'hover'})
                    .show()
                    .click(function(e) {
                        $dbtable.data('dbtable').init_search_inputs();
                    })
            }
        }

        if (!this.virtual_table && options.refresh_button) {
            header.find('.form-header-refresh-btn')
                .html('<button type="button" class="btn btn-secondary refresh-btn">' +
                    '<i class="bi bi-arrow-clockwise"></i>' +
                    '</button>')
                .tooltip({placement: 'bottom', title: task.language.refresh_page, trigger: 'hover'});
            header.find(".refresh-btn").css('cursor', 'default').click(function(e) {
                e.preventDefault();
                self.refresh(true);
            });
        }
        else {
            header.find('.form-header-refresh-btn').hide();
        }

        if (this.each_filter) {
            this.each_filter(function(f) {
                if (f.visible) {
                    filter_count += 1;
                }
            })
        }
        if (options.enable_filters && filter_count) {
            let filtered_sign = $('<span class="filtered_sign"></span>')
            header.find('.form-header-filters')
                .html(
                    '<button type="button" class="btn btn-secondary form-header-filters-btn">' +
                    '<i class="bi bi-funnel"></i>' + '</button>' +
                    //~ task.language.filters + '</button>' +
                    '<span class="filters-text"></span>'
                );
            header.find('.form-header-filters-btn')
                .tooltip({placement: 'bottom', title: task.language.set_filters, trigger: 'hover'})
                .css('cursor', 'default')
                .click(function(e) {
                    e.preventDefault();
                    self.create_filter_form();
                })
                .append(filtered_sign);
        }

        header.find('.form-header-title').html('<h5 class="form-title">' + title + '</h5>')

        header.find(".close-form-btn").click(function(e) {
            if (form_name) {
                self._close_form(form_type);
            }
        });
        header.find('#print-btn').css('cursor', 'default').click(function(e) {
            if (form.find(".form-body").length) {
                body = form.find(".form-body");
            }
            else if (form.find(".modal-body").length) {
                body = form.find(".modal-body");
            }
            self.print_html(body);
        });

        if (options.form_header) {
            header.css('display', 'flex');
        }
        else {
            header.remove();
        }
        if (task.media > 0) {
            form.find('.form-header .btn small,  .form-footer .btn small').hide();
        }
        if (task.media === 2 && form_type === 'view') {
            form.find('.form-header button.btn,  .form-footer button.btn, .form-header a.btn,  .form-footer a.btn').each(function() {
                let image = $(this).find('i');
                if (image.length) {
                    $(this).html(image.get(0));
                }
            });
        }
    }

    init_filters() {
        var self = this;
        this._on_filters_applied_internal = function() {
            if (self.view_form) {
                let filter_text = self.get_filter_html();
                if (task.media < 2) {
                    self.view_form.find(".filters-text").html(filter_text);
                }
                else {
                    let filtered_sign = '';
                    if (filter_text) {
                        filtered_sign = '*';
                    }
                    self.view_form.find('.filtered_sign').text(filtered_sign);
                }
            }
        };
    }

    _can_search_on_field(field) {
        if (field && field.lookup_type !== "boolean" &&
            field.lookup_type !== "image" &&
            field.lookup_type !== "date" &&
            field.lookup_type !== "datetime") {
            return true;
        }
    }

    _init_column_title_search(field, $search_input) {
        let self = this,
            time_out;

        $search_input.on('input', function() {
            let $input = $(this);
            $input.css('font-weight', 'normal')
            clearTimeout(time_out);
            time_out = setTimeout(
                function() {
                    let search_type = 'contains_all';
                    self.set_order_by(self.view_options.default_order);
                    self._search_params = self.search(field.field_name, $input.val(), search_type, true, function() {
                        $input.css('font-weight', 'bold')
                    });
                },
                500
            );
        });

        $search_input.keyup(function(e) {
            var code = e.which;
            if (code === 13) {
                e.preventDefault();
            }
        });
        $search_input.on('mousedown', (function(e) {
            e.stopPropagation();
        }));
    }

    _process_key_event(form_type, event_type, e) {
        var i,
            form = this[form_type + '_form'],
            item_options = this[form_type + '_options'],
            forms;
        if (this._active_form(form_type)) {
            if (form._form_disabled) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
            else {
                //~ if (e.which !== 116) { //F5
                    //~ e.stopPropagation();
                //~ }
                this._process_event(form_type, event_type, e);
                forms = form.find('.jam-form');
                forms.each(function() {
                    var form = $(this),
                        options = form.data('options');
                    if (form.is(":visible")) {
                        options.item._process_event(options.form_type, event_type, e);
                    }
                });
            }
        }
    }

    _process_event(form_type, event_type, e) {
        var event = 'on_' + form_type + '_form_' + event_type,
            can_close,
            index;
        if (event_type === 'close_query') {
            if (this[event]) {
                can_close = this[event].call(this, this);
            }
            if (!(this.master || this.master_field) && can_close === undefined && this.owner[event]) {
                can_close = this.owner[event].call(this, this);
            }
            if (can_close === undefined && this.task[event]) {
                can_close = this.task[event].call(this, this);
            }
            return can_close;
        }
        else if (event_type === 'keyup' || event_type === 'keydown') {
            if (this[event]) {
                if (this[event].call(this, this, e)) return;
            }
            if (!(this.master || this.master_field) && this.owner[event]) {
                if (this.owner[event].call(this, this, e)) return;
            }
            if (this.task[event]) {
                if (this.task[event].call(this, this, e)) return;
            }
        }
        else {
            if (this.task[event]) {
                if (this.task[event].call(this, this)) return;
            }
            if (!(this.master || this.master_field) && this.owner[event]) {
                if (this.owner[event].call(this, this)) return;
            }
            if (this[event]) {
                if (this[event].call(this, this)) return;
            }
        }
        if (form_type === 'edit') {
            if (event_type === 'shown') {
                task._edited_items.push(this);
            }
            else if (event_type === 'closed') {
                index = task._edited_items.indexOf(this)
                if (index > -1) {
                  task._edited_items.splice(index, 1);
                }
            }
        }
    }

    _active_form(form_type) {
        var self = this,
            form_name = form_type + '_form',
            form = this[form_name],
            cur_form = $(document.activeElement).closest('.jam-form.' + form_type + '-form'),
            result = false;
        if (cur_form.length) {
            if (form.get(0) === cur_form.get(0)) {
                result = true;
            }
        }
        else {
            $('.jam-form').each(function() {
                var form = $(this),
                    options;
                if (form.is(':visible') && form.hasClass(form_type + '-form') &&
                    form.hasClass(self.item_name)) {
                    options = form.data('options');
                    if (self._tab_info) {
                        if (self._tab_info.tab_id === options.item_options.tab_id) {
                            result = true;
                            return false;
                        }
                    }
                    else {
                        result = true;
                        return false;
                    }

                }
            })
        }
        return result;
    }

    _key_suffix(form_type, options) {
        let result = form_type + '_form' + '.' + this.item_name;
        if (options.tab_id) {
            result += '.' + options.tab_id;
        }
        return result;
    }

    _create_form(form_type, container) {
        var self = this,
            form,
            form_name = form_type + '_form',
            options = {},
            item_options = this[form_type + '_options'],
            key_suffix,
            resize_timeout,
            width;

        options.item = this;
        options.form_type = form_type;
        options.item_options = item_options;
        options.item_options.form_type = form_type;
        key_suffix = this._key_suffix(form_type, item_options);
        if (container) {
            container.empty();
            this.task.default_content_visible = false;
        }
        form = $("<div></div>").append(this.find_template(form_type, item_options));
        form = this._create_form_header(form, item_options, form_type, container);
        this[form_name] = form
        if (form) {
            options.form = form;
            form.data('options', options);
            form.tabindex = 1;
            if (container) {
                $(window).on("keyup." + key_suffix, function(e) {
                    if (e.which === 27 && item_options.close_on_escape) {
                        if (self._active_form(form_type)) {
                            self._close_form(form_type);
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                        }
                    }
                    else {
                        self._process_key_event(form_type, 'keyup', e);
                    }
                });
                $(window).on("keydown." + key_suffix, function(e) {
                    self._process_key_event(form_type, 'keydown', e)
                });
                container.append(form);
                this[form_name].bind('destroyed', function() {
                    self._close_modeless_form(form_name);
                });
                this._set_form_options(form, item_options, form_type);
                this._process_event(form_type, 'created');
                this._set_form_options(form, item_options, form_type);
                task._focus_element(form);
                this._process_event(form_type, 'shown');
            } else {
                task.modals.create_modal_form(form, item_options, this, form_type);
            }
        }
    }

    _close_modeless_form(form_type) {
        var self = this,
            form_name = form_type + '_form';
        if (this[form_name]) {
            this._close_form(form_type);
        }
        if (this[form_name]) {
            this[form_name].bind('destroyed', function() {
                self._close_modeless_form(form_type);
            });
            throw new Error(this.item_name + " - can't close form");
        }
    }

    _close_form(form_type) {
        var self = this,
            form_name = form_type + '_form',
            form = this[form_name],
            options,
            key_suffix;

        if (form) {
            options = form.data('options'),
            key_suffix = form_name + '.' + this.item_name;
            if (options.item_options.tab_id) {
                key_suffix += '.' + options.item_options.tab_id;
            }
            let can_close = this._process_event(options.form_type, 'close_query');
            if (can_close !== false && this[form_name]) {
                form.data('_closing', true);
                form.find('.jam-form').data('_closing', true);
                if (form.hasClass('modal-form')) {
                    setTimeout(
                        function() {
							let key = 'modal_' + form_type + '_object';
							if (self[key]) {
								self['modal_' + form_type + '_object'].close_form();
							}
                            //self['modal_' + form_type + '_object'].close_form();
                            this[form_name] = undefined;
                            self._process_event(options.form_type, 'closed');
                            form.data('_closing', false);
                        },
                        100
                    );
                } else {
                    $(window).off("keydown." + key_suffix);
                    $(window).off("keyup." + key_suffix);
                    $(window).off("resize." + key_suffix);
                    this[form_name] = undefined;
                    if (this._tab_info) {
                        this.task.close_tab(this._tab_info.container, this._tab_info.tab_id);
                        this._tab_info = undefined;
                    }
                    form.data('_closing', false);
                    self._process_event(options.form_type, 'closed');
                    form.remove();
                    let forms = $(".jam-form:not('.modal-form')");
                    if (forms.length === 0) {
                        this.task.default_content_visible = true;
                    }
                }
            }
        }
    }

    update_form(form) {
        form.modal('layout');
    }

    disable_edit_form() {
        this._disable_form(this.edit_form);
    }

    enable_edit_form() {
        this._enable_form(this.edit_form);
    }

    edit_form_disabled() {
        return this.edit_form._form_disabled;
    }

    _disable_form(form) {
        if (form) {
            form.css('pointer-events', 'none');
            form._form_disabled = true;
        }
    }

    _enable_form(form) {
        if (form) {
            form.css('pointer-events', 'auto');
            form._form_disabled = false;
        }
    }

    print_html(html) {
        var win = window.frames["dummy"],
            css = $("link[rel='stylesheet']"),
            body,
            head = '<head>';
        css.each(function(i, e) {
            head += '<link href="' + e.href + '" rel="stylesheet">';
        });
        head += '</head>';
        body = html.clone();
        win.document.write(head + '<body onload="window.print()">' + body.html() + '</body>');
        win.document.close();
    }

    alert(message, options) {
        var default_options = {
                type: 'info',
                header: undefined,
                align: 'right',
                replace: true,
                pulsate: true,
                click_close: true,
                body_click_hide: false,
                show_header: true,
                duration: 5,
                timeout: 0
            },
            pos = 0,
            width = 0,
            container = $('body'),
            $alert;
        options = $.extend({}, default_options, options);
        if (!options.replace && $('body').find('.alert-absolute').length) {
            return;
        }
        if (!options.header) {
            let type = options.type;
            if (options.type === "danger") {
                type = "error"
            }
            options.header = task.language[type];
        }
        if (!options.header) {
            options.show_header = false;
        }
        $alert = $(
        '<div class="alert alert-dismissible alert-absolute fade show">' +
          '<h4>' + options.header + '</h4>' +
          '<p>' + message + '</p>' +
          '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
        '</div>'
        );
        if (task.forms_container && task.forms_container.length) {
            container = task.forms_container;
        }
        else {
            $('body').children().each(function() {
                var $this = $(this);
                if ($this.width() > width && $this.css('z-index') === 'auto') {
                    width = $this.width();
                    container = $this;
                }
            });
        }
        $('body').find('.alert-absolute').remove();
        if (options.body_click_hide) {
            $('body')
                .off('mouseup.alert-absolute')
                .on('mouseup.alert-absolute', function(e) {
                $('body').find('.alert-absolute').remove();
            });
        }
        $(window)
            .off('resize.alert-absolute')
            .on('resize.alert-absolute', function(e) {
            $('body').find('.alert-absolute').remove();
        })

        $alert.addClass('alert-' + options.type)
        if (options.pulsate) {
            $alert.find('h4').addClass('pulsate');
        }
        if (!options.show_header) {
            $alert.find('h4').hide();
        }
        $('body').append($alert);
        $alert.css('top', 0);
        if (options.align === 'right') {
            if (container) {
                pos = $(window).width() - (container.offset().left + container.width())
            }
            $alert.css('right', pos);
        }
        else {
            if (container) {
                pos = container.offset().left;
            }
            $alert.css('left', pos);
        }
        $alert.show();
        if (options.duration) {
            setTimeout(function() {
                    $alert.hide(100);
                    setTimeout(function() {
                            $alert.remove();
                        },
                        100
                    );
                },
                options.duration * 1000
            );
        }
    }

    alert_error(message, options) {
        options = $.extend({}, options);
        options.type = 'danger';
        this.alert(message, options);
    }

    alert_success(message, options) {
        options = $.extend({}, options);
        options.type = 'success';
        this.alert(message, options);
    }

    message(mess, options) {
        let self = this,
            default_options = {
                title: '',
                width: '25rem',
                form_header: true,
                height: undefined,
                margin: undefined,
                buttons: undefined,
                button_class: {},
                default_button: undefined,
                print: false,
                text_center: false,
                button_min_width: '5rem',
                center_buttons: false,
                close_button: true,
                close_on_escape: true,
                focus_last_btn: false,
                hide: true
            },
            $element,
            $form_body,
            timeOut,
            modal_object;

        if (mess instanceof jQuery) {
            mess = mess.clone()
        }
        options = $.extend({}, default_options, options);
        let buttons = options.buttons;

        let el = '<div class="form-body"></div>';
        if (!this.is_empty_obj(buttons)) {
            el += '<div class="form-footer"></div>';
        }

        $element = this._create_form_header($(el), options);

        $form_body = $element.find('.form-body');

        if (options.margin) {
            $form_body.css('margin', options.margin);
        }

        if (options.height) {
            $form_body.css('height', options.height);
            $form_body.css('overflow', 'overlay');
        }
        $form_body.html(mess);

        if (!options.title) {
            $element.find('.form-header').remove();
        }

        if (options.text_center) {
            $form_body.html(mess).addClass("text-center");
        }
        if (options.center_buttons) {
            $element.find(".form-footer").addClass('message');
        }

        $element.find(".close-form-btn").click(function(e) {
            modal_object.close_form();
        });
        let btn_str = '<button type="button" class="btn">OK</button>',
            btn_col_str = '<div class="col">',
            $btns_div = $('<div class="row gx-1 gx-sm-2 gx-md-3 gx-lg-4">');
        for (let key in buttons) {
            if (buttons.hasOwnProperty(key)) {
                let $btn = $(btn_str)
                    .data('key', key)
                    .css("min-width", options.button_min_width)
                    .html(key)
                    .click(function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        var key = $(this).data('key');
                        setTimeout(function() {
                                try {
                                    if (buttons[key]) {
                                        buttons[key].call(self);
                                    }
                                }
                                catch (e) {
                                    console.error(e);
                                }
                                if (options.hide) {
                                    modal_object.close_form();
                                }
                            },
                            100
                        );
                    })
                    let btn_class = 'btn-secondary';
                    if (options.button_class[key]) {
                        btn_class = options.button_class[key];
                    }
                    $btn.addClass(btn_class);
                let $btn_col = $(btn_col_str).append($btn);
                $btns_div.append($btn_col)
            }
        }
        if ($btns_div.children.length) {
            $element.find(".form-footer").append($btns_div);
        }

        $element.on_shown = function() {
            if (options.focus_last_btn) {
                $element.find(".form-footer button.btn:last").focus();
            }
        };

        $element.on("keyup keydown", function(e) {
            var event;
            if (e.which === 37 || e.which === 39) {
                event = jQuery.Event(e.type);
                event.which = e.which + 1;
                $(e.target).trigger(event);
            }
            else if (e.which === 80 && e.ctrlKey) {
                e.preventDefault();
                self.print_html($element.find(".form-body"));
            }
        });

        modal_object = task.modals.create_modal_form($element, options);
        return modal_object;
    }

    question(mess, yesCallback, noCallback, options) {
        let buttons = {},
            button_class = {},
            default_options = {
                buttons: buttons,
                margin: "1.5rem 1.5rem",
                text_center: true,
                center_buttons: true,
                focus_last_btn: true,
                button_class: button_class
            };
        options = $.extend({}, default_options, options);
        buttons[task.language.yes] = yesCallback;
        buttons[task.language.no] = noCallback;
        button_class[task.language.yes] = 'btn-primary';
        return this.message(mess, options);
    }

    warning(mess, callback, options) {
        var buttons = {"OK": callback},
            default_options = {
                buttons: buttons,
                margin: "1.5rem 1.5rem",
                text_center: true,
                center_buttons: true,
                focus_last_btn: true,
            }
        options = $.extend({}, default_options, options);
        return this.message(mess, options);
    }

    show_message(mess, options) {
        return this.message(mess, options);
    }

    hide_message(modal_object) {
        modal_object.close_form();
    }

    yes_no_cancel(mess, yesCallback, noCallback, cancelCallback) {
        var buttons = {},
            button_class = {}
        buttons[task.language.yes] = yesCallback;
        buttons[task.language.no] = noCallback;
        buttons[task.language.cancel] = cancelCallback;
        button_class[task.language.yes] = 'btn-primary';
        button_class[task.language.cancel] = 'btn-outline-secondary';
        return this.message(mess, {
            buttons: buttons,
            button_class: button_class,
            margin: "1.5rem 1.5rem",
            text_center: true,
            width: 500,
            center_buttons: true
        });
    }

    display_history(hist) {
        var self = this,
            html = '',
            acc_div = $('<div class="accordion" id="history_accordion">'),
            item,
            master,
            lookups = {},
            lookup_keys,
            lookup_fields,
            keys,
            fields,
            where,
            lookup_item,
            mess;
        if (self.master) {
            master = self.master.copy({handlers: false});
            item = master.item_by_ID(self.ID);
            master.open({open_empty: true});
            master.append();
        }
        else {
            item = self.copy({handlers: false, details: false});
        }
        item.open({open_empty: true});
        item.append();
        hist.each(function(h) {
            var acc = $(
                '<div class="accordion-item">' +
                    '<h3 class="accordion-header">' +
                        '<button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#collapse' + h.rec_no + '">' +
                        '</button>' +
                    '</h3>' +
                    '<div id="collapse' + h.rec_no + '" class="accordion-collapse collapse" data-bs-parent="#history_accordion">' +
                        '<div class="accordion-body">' +

                        '</div>' +
                    '</div>' +
                 '</div>'
                ),
                i,
                user = '',
                content = '',
                old_value,
                new_value,
                val_index,
                field,
                field_name,
                changes,
                operation,
                field_arr;
            changes = h.changes.value;
            if (changes && changes[0] === '0') {
                changes = changes.substring(1);
                changes = JSON.parse(changes);
            }
            if (h.operation.value === consts.RECORD_DELETED) {
                content = '<p>Record deleted</p>'
            }
            else if (changes) {
                field_arr = changes;
                if (field_arr) {
                    for (i = 0; i < field_arr.length; i++) {
                        field = item.field_by_ID(field_arr[i][0]);
                        val_index = 1;
                        if (field_arr[i].length === 3) {
                            val_index = 2;
                        }
                        if (field && !field.system_field()) {
                            field_name = field.field_caption;
                            if (field.lookup_item) {
                                if (!lookups[field.lookup_item.ID]) {
                                    lookups[field.lookup_item.ID] = [];
                                }
                                field.data = field_arr[i][val_index];
                                new_value = field.value;
                                if (new_value) {
                                    lookups[field.lookup_item.ID].push([field.lookup_field, new_value]);
                                    new_value = '<span class="' + field.lookup_field + '_' + new_value + '">' + task.language.value_loading + '</span>'
                                }
                            }
                            else {
                                field.data = field_arr[i][val_index];
                                new_value = field.sanitized_text;
                                if (field.data === null) {
                                    new_value = ' '
                                }
                            }
                            if (h.operation.value === consts.RECORD_INSERTED) {
                                content += '<p>' + self.task.language.field + ' <b>' + field_name + '</b>: ' +
                                    self.task.language.new_value + ': <b>' + new_value + '</b></p>';
                            }
                            else if (h.operation.value === consts.RECORD_MODIFIED) {
                                content += '<p>' + self.task.language.field + ' <b>' + field_name + '</b>: ' +
                                    self.task.language.new_value + ': <b>' + new_value + '</b></p>';
                            }
                        }
                    }
                }
            }
            if (h.user.value) {
                user = self.task.language.by_user + ' ' + h.user.value;
            }
            if (h.operation.value === consts.RECORD_INSERTED) {
                operation = self.task.language.created;
            }
            else if (h.operation.value === consts.RECORD_MODIFIED ||
                h.operation.value === consts.RECORD_DETAILS_MODIFIED) {
                operation = self.task.language.modified;
            }
            else if (h.operation.value === consts.RECORD_DELETED) {
                operation = self.task.language.deleted;
            }

            acc.find('.accordion-button')
                .html(h.date.format_date_to_string(h.date.value, '%d.%m.%Y %H:%M:%S') + ': ' +
                    operation + ' ' + user);
            acc.find('.accordion-body').html(content);
            if (h.rec_no === 0) {
                acc.find('.accordion-button').removeClass('collapsed');
                acc.find('.accordion-collapse').addClass('show');
            }
            acc_div.append(acc)
        })
        if (hist.record_count()) {
            html = acc_div;
        }
        mess = self.task.message(html, {width: 600, height: 600,
            title: hist.item_caption + ': ' + self.item_caption, footer: false, print: true});
        for (var ID in lookups) {
            if (lookups.hasOwnProperty(ID)) {
                lookup_item = self.task.item_by_ID(parseInt(ID, 10));
                if (lookup_item) {
                    lookup_item = lookup_item.copy({handlers: false});
                    lookup_keys = {};
                    lookup_fields = {};
                    lookup_fields[lookup_item._primary_key] = true;
                    for (var i = 0; i < lookups[ID].length; i++) {
                        lookup_fields[lookups[ID][i][0]] = true;
                        lookup_keys[lookups[ID][i][1]] = true;
                    }
                    keys = [];
                    for (var key in lookup_keys) {
                        if (lookup_keys.hasOwnProperty(key)) {
                            keys.push(parseInt(key, 10));
                        }
                    }
                    fields = [];
                    for (var field in lookup_fields) {
                        if (lookup_fields.hasOwnProperty(field)) {
                            fields.push(field);
                        }
                    }
                    where = {}
                    where[lookup_item._primary_key + '__in'] = keys
                    lookup_item.open({where: where, fields: fields}, function() {
                        var lookup_item = this;
                        lookup_item.each(function(l) {
                            l.each_field(function(f) {
                                if (!f.system_field()) {
                                    acc_div.find("." + f.field_name + '_' + l._primary_key_field.value).text(f.sanitized_text);
                                }
                            });
                        });
                    })
                }
            }
        }
    }

    show_history() {
        var self = this,
            item_id = this.ID,
            hist = this.task.history_item.copy();
        if (!this.rec_count) {
            this.warning(task.language.no_record);
            return;
        }
        if (this.master) {
            item_id = this.prototype_ID;
        }
        hist.set_where({item_id: item_id, item_rec_id: this.field_by_name(this._primary_key).value})
        hist.set_order_by(['-date']);
        hist.open({limit: 100}, function() {
            self.display_history(hist);
        });
    }

    is_empty_obj(obj) {
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop))
                return false;
        }
        return true;
    }

    abort(message) {
        message = message ? ' - ' + message : '';
        throw new AbortError(this.item_name + message);
    }

    log_message(message) {
        if (this.task.settings.DEBUGGING) {
            message = message ? ' message: ' + message : '';
            console.log(this.item_name + message);
        }
    }

    round(num, dec) {
        if (dec === undefined) {
            dec = 0;
        }
        let result = Number(Math.round(Math.abs(num) + 'e' + dec) + 'e-' + dec);
        if (isNaN(result)) {
            result = 0;
        }
        if (num < 0) {
            result = -result;
        }
        return result;
    }

    str_to_int(str) {
        var result = parseInt(str, 10);
        if (isNaN(result)) {
            throw new Error(task.language.invalid_int.replace('%s', ''));
        }
        return result;
    }

    str_to_date(str) {
        return this.format_string_to_date(str, task.locale.D_FMT);
    }

    str_to_datetime(str) {
        return this.format_string_to_date(str, task.locale.D_T_FMT);
    }

    str_to_float(text) {
        var result;
        text = text.replace(task.locale.DECIMAL_POINT, ".")
        text = text.replace(task.locale.MON_DECIMAL_POINT, ".")
        result = parseFloat(text);
        if (isNaN(result)) {
            throw new Error(task.language.invalid_float.replace('%s', ''));
        }
        return result;
    }

    str_to_cur(val) {
        var result = '';
        if (val) {
            result = $.trim(val);
            result = result.replace(' ', '')
            if (task.locale.MON_THOUSANDS_SEP.length) {
                result = result.replace(new RegExp('\\' + task.locale.MON_THOUSANDS_SEP, 'g'), '');
            }
            if (task.locale.CURRENCY_SYMBOL) {
                result = $.trim(result.replace(task.locale.CURRENCY_SYMBOL, ''));
            }
            if (task.locale.POSITIVE_SIGN) {
                result = result.replace(task.locale.POSITIVE_SIGN, '');
            }
            if (task.locale.N_SIGN_POSN === 0 || task.locale.P_SIGN_POSN === 0) {
                result = result.replace('(', '').replace(')', '')
            }
            if (task.locale.NEGATIVE_SIGN && result.indexOf(task.locale.NEGATIVE_SIGN) !== -1) {
                result = result.replace(task.locale.NEGATIVE_SIGN, '')
                result = '-' + result
            }
            result = $.trim(result.replace(task.locale.MON_DECIMAL_POINT, '.'));
            result = parseFloat(result);
        }
        return result;
    }

    int_to_str(value) {
        if (value || value === 0) {
            return value.toString();
        }
        else {
            return '';
        }
    }

    float_to_str(value) {
        var str,
            i,
            result = '';
        if (value || value === 0) {
            str = ('' + value.toFixed(6)).replace(".", task.locale.DECIMAL_POINT);
            i = str.length - 1;
            for (; i >= 0; i--) {
                if ((str[i] === '0') && (result.length === 0)) {
                    continue;
                } else {
                    result = str[i] + result;
                }
            }
            if (result.slice(result.length - 1) === task.locale.DECIMAL_POINT) {
                result = result + '0';
            }
        }
        return result;
    }

    date_to_str(value) {
        if (value) {
            return this.format_date_to_string(value, task.locale.D_FMT);
        }
        else {
            return '';
        }
    }

    datetime_to_str(value) {
        if (value) {
            return this.format_date_to_string(value, task.locale.D_T_FMT);
        }
        else {
            return '';
        }
    }

    cur_to_str(value) {
        var point,
            dec,
            digits,
            i,
            d,
            count = 0,
            len,
            result = '';

        if (value || value === 0) {
            result = this.round(value, task.locale.FRAC_DIGITS).toFixed(task.locale.FRAC_DIGITS);
            if (isNaN(result[0])) {
                result = result.slice(1, result.length);
            }
            point = result.indexOf('.');
            dec = '';
            digits = result;
            if (point >= 0) {
                digits = result.slice(0, point);
                dec = result.slice(point + 1, result.length);
            }
            result = '';
            len = digits.length;
            for (i = 0; i < len; i++) {
                d = digits[len - i - 1];
                result = d + result;
                count += 1;
                if ((count % 3 === 0) && (i !== len - 1)) {
                    result = task.locale.MON_THOUSANDS_SEP + result;
                }
            }
            if (dec) {
                result = result + task.locale.MON_DECIMAL_POINT + dec;
            }
            if (value < 0) {
                if (task.locale.N_SIGN_POSN === 3) {
                    result = task.locale.NEGATIVE_SIGN + result;
                } else if (task.locale.N_SIGN_POSN === 4) {
                    result = result + task.locale.NEGATIVE_SIGN;
                }
            } else {
                if (task.locale.P_SIGN_POSN === 3) {
                    result = task.locale.POSITIVE_SIGN + result;
                } else if (task.locale.P_SIGN_POSN === 4) {
                    result = result + task.locale.POSITIVE_SIGN;
                }
            }
            if (task.locale.CURRENCY_SYMBOL) {
                if (value < 0) {
                    if (task.locale.N_CS_PRECEDES) {
                        if (task.locale.N_SEP_BY_SPACE) {
                            result = task.locale.CURRENCY_SYMBOL + ' ' + result;
                        } else {
                            result = task.locale.CURRENCY_SYMBOL + result;
                        }
                    } else {
                        if (task.locale.N_SEP_BY_SPACE) {
                            result = result + ' ' + task.locale.CURRENCY_SYMBOL;
                        } else {
                            result = result + task.locale.CURRENCY_SYMBOL;
                        }
                    }
                } else {
                    if (task.locale.P_CS_PRECEDES) {
                        if (task.locale.P_SEP_BY_SPACE) {
                            result = task.locale.CURRENCY_SYMBOL + ' ' + result;
                        } else {
                            result = task.locale.CURRENCY_SYMBOL + result;
                        }
                    } else {
                        if (task.locale.P_SEP_BY_SPACE) {
                            result = result + ' ' + task.locale.CURRENCY_SYMBOL;
                        } else {
                            result = result + task.locale.CURRENCY_SYMBOL;
                        }
                    }
                }
            }
            if (value < 0) {
                if (task.locale.N_SIGN_POSN === 0 && task.locale.NEGATIVE_SIGN) {
                    result = task.locale.NEGATIVE_SIGN + '(' + result + ')';
                } else if (task.locale.N_SIGN_POSN === 1) {
                    result = task.locale.NEGATIVE_SIGN + result;
                } else if (task.locale.N_SIGN_POSN === 2) {
                    result = result + task.locale.NEGATIVE_SIGN;
                }
            } else {
                if (task.locale.P_SIGN_POSN === 0 && task.locale.POSITIVE_SIGN) {
                    result = task.locale.POSITIVE_SIGN + '(' + result + ')';
                } else if (task.locale.P_SIGN_POSN === 1) {
                    result = task.locale.POSITIVE_SIGN + result;
                } else if (task.locale.P_SIGN_POSN === 2) {
                    result = result + task.locale.POSITIVE_SIGN;
                }
            }
        }
        return result;
    }

    parseDateInt(str, digits) {
        var result = parseInt(str.substring(0, digits), 10);
        if (isNaN(result)) {
            throw new Error(task.language.invalid_date.replace('%s', ''))
        }
        return result;
    }

    format_string_to_date(str, format) {
        var ch = '',
            substr = str,
            day, month, year,
            hour = 0,
            min = 0,
            sec = 0;
        if (str) {
            for (var i = 0; i < format.length; ++i) {
                ch = format.charAt(i);
                switch (ch) {
                    case "%":
                        break;
                    case "d":
                        day = this.parseDateInt(substr, 2);
                        substr = substr.slice(2);
                        break;
                    case "m":
                        month = this.parseDateInt(substr, 2);
                        substr = substr.slice(2);
                        break;
                    case "Y":
                        year = this.parseDateInt(substr, 4);
                        substr = substr.slice(4);
                        break;
                    case "H":
                        hour = this.parseDateInt(substr, 2);
                        substr = substr.slice(2);
                        break;
                    case "M":
                        min = this.parseDateInt(substr, 2);
                        substr = substr.slice(2);
                        break;
                    case "S":
                        sec = this.parseDateInt(substr, 2);
                        substr = substr.slice(2);
                        break;
                    default:
                        substr = substr.slice(ch.length);
                }
            }
            if (month < 1 || month > 12 || day < 1 || day > 31 || hour < 0 || hour > 24 ||
                min < 0 || min > 60 || sec < 0 || sec > 60) {
                    throw new Error(task.language.invalid_date.replace('%s', str));
            }
            return new Date(year, month - 1, day, hour, min, sec);
        }
        else {
            return str;
        }
    }

    leftPad(value, len, ch) {
        var result = value.toString();
        while (result.length < len) {
            result = ch + result;
        }
        return result;
    }

    format_date_to_string(date, format) {
        var ch = '',
            result = '';
        for (var i = 0; i < format.length; ++i) {
            ch = format.charAt(i);
            switch (ch) {
                case "%":
                    break;
                case "d":
                    result += this.leftPad(date.getDate(), 2, '0');
                    break;
                case "m":
                    result += this.leftPad(date.getMonth() + 1, 2, '0');
                    break;
                case "Y":
                    result += date.getFullYear();
                    break;
                case "H":
                    result += this.leftPad(date.getHours(), 2, '0');
                    break;
                case "M":
                    result += this.leftPad(date.getMinutes(), 2, '0');
                    break;
                case "S":
                    result += this.leftPad(date.getSeconds(), 2, '0');
                    break;
                default:
                    result += ch;
            }
        }
        return result;
    }

    sanitize_html(text) {
        let element = document.createElement('div');
        element.innerText = text;
        return element.innerHTML;
    }
}

export default AbsrtactItem
