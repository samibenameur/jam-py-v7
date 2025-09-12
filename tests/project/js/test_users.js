var assert = chai.assert,
    expect = chai.expect;

describe('CRUD', function() {
    let users;

    before(function() {
        task.server('prepare_users'); // optional server setup, like you did with prepare_field_items
    });

    beforeEach(function() {
        users = task.users.copy();
        users.open({open_empty: true});
    });

    it('should Create a user', function() {
        users.append();
        users.field_by_name('username').value = 'crud_user';
        users.post();
        users.apply();

        users.open();
        assert.equal(users.rec_count, 1);
        assert.equal(users.field_by_name('username').value, 'crud_user');
    });

    it('should Read a user', function() {
        users.open();
        assert.equal(users.rec_count, 1);
        assert.equal(users.field_by_name('username').text, 'crud_user');
    });

    it('should Update a user', function() {
        users.open();
        users.edit();
        users.field_by_name('username').value = 'updated_user';
        users.post();
        users.apply();

        users.open();
        assert.equal(users.field_by_name('username').value, 'updated_user');
    });

    it('should Delete a user', function() {
        users.open();
        users.delete();
        users.apply();

        users.open();
        assert.equal(users.rec_count, 0);
    });
});


