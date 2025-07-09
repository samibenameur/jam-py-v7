import sqlite3
import re
import json
import sqlparse
import os
import argparse
import mysql.connector

# === CONFIGURATION ===
ADMIN_FILE = 'admin.sqlite'

RESERVED_FIELD_NAMES = {"active", "class", "def", "from", "global", "import", "lambda", "placeholder", "hidden", "progress", "task", "label", "badge", "order", "privileges"}


# SYS_ITEMS config
ITEM_START_ID = 6
PARENT_ID = 2
TASK_ID = 1
TYPE_ID = 10
VISIBLE = 1
DELETED = 0
TABLE_ID = 0

# SYS_FIELDS config
FIELD_START_ID = 15
OWNER_ID = 3
F_ALIGNMENT = 1
F_TEXTAREA = 0
F_DO_NOT_SANITIZE = 0
F_CALC_LOOKUP_FIELD = 0
F_REQUIRED = 0

JAM_TYPES = TEXT, INTEGER, FLOAT, CURRENCY, DATE, DATETIME, BOOLEAN, LONGTEXT, KEYS, FILE, IMAGE = range(1, 12)

FIELD_TYPES = {
    INTEGER: 'INTEGER',
    TEXT: 'TEXT',
    FLOAT: 'REAL',
    CURRENCY: 'REAL',
    DATE: 'TEXT',
    DATETIME: 'TEXT',
    BOOLEAN: 'INTEGER',
    LONGTEXT: 'TEXT',
    KEYS: 'TEXT',
    FILE: 'TEXT',
    IMAGE: 'TEXT'
}

def sanitize_field_name(name):
    return name + "_f" if name in RESERVED_FIELD_NAMES else name


def get_table_info(db_file, table_name):
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    cursor.execute(f'PRAGMA table_info("{table_name}")')  # safer with quotes
    result = cursor.fetchall()
    fields = []
    for r in result:
        fields.append({
            'col_name': r[1],
            'col_type': r[2],
            'col_constraints': r[4],
            'pk': r[5] == 1
        })

    return {
        'fields': fields
    }
def get_table_info(connection, table_name):
    cursor = connection.cursor()
    sql = 'SHOW COLUMNS FROM "%s"' % table_name
    cursor.execute(sql)
    result = cursor.fetchall()
    fields = []
    for (field_name, type_size, null, key, default_value, autoinc) in result:
        try:
            pk = False
            if autoinc and key == 'PRI':
                pk = True
            data_type = type_size.split('(')[0].upper()
            size = type_size.split('(')[1].split(')')[0]
            if size:
                size = int(size)
            if not data_type in ['VARCHAR', 'CHAR']:
                size = 0
        except:
            data_type = type_size
            size = 0
        fields.append({
            'col_name': field_name,
            'col_type': data_type,
#            'size': size,
            'col_constraints': default_value,
            'pk': pk
        })
    return {'fields': fields}


def get_table_names(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sqlite_master WHERE type='table'")
    result = cursor.fetchall()
    #print(f"\n✅ {[r[1] for r in result]} ")
    return [r[1] for r in result]
def get_table_names(connection):
    cursor = connection.cursor()
    cursor.execute('show tables')
    result = cursor.fetchall()
    return [r[0] for r in result]


# === HELPERS ===
def to_caption(name):
    return name.replace('_', ' ').title()

def to_camel_case(name):
    parts = name.lower().split('_')
    return parts[0] + ''.join(x.capitalize() for x in parts[1:])

def get_f_data_type(sql_type, col_name):
    if 'DATE' in col_name.upper():
        return 5
    sql_type = sql_type.upper()
    if sql_type == 'TEXT':
        return 1
    elif sql_type == 'INTEGER':
        return 2
    elif sql_type == 'BIGINT':
        return 2
    elif sql_type == 'FLAT':
        return 3
    elif sql_type == 'REAL':
        return 4
    return 1


def matches(conn):
    matches = get_table_names(conn)
    if not matches:
        print("❌ No valid CREATE TABLE statements found.")
        exit(1)

def get_database_path():
    db_path = input("Enter the path to your SQLite database file: ").strip()
    while not os.path.isfile(db_path):
        print("File not found. Please try again.")
        db_path = input("Enter the path to your SQLite database file: ").strip()
    print(db_path)
    return db_path

def connect_to_database(db_path):
    try:
        conn = sqlite3.connect(db_path)
        print(f"\n✅ Connected to database: {db_path}")
        return conn
    except sqlite3.Error as e:
        print(f"\n❌ Error connecting to database: {e}")
        return None
def connect_to_database(db_info):
    try:
        args = {
            'db': db_info['database'],
            'user': db_info['user'],
            'passwd': db_info['password'],
            'host': db_info['host'],
        }
        if db_info.get('port'):
            args['port'] = db_info['port']
        if db_info.get('encoding'):
            args['charset'] = db_info['encoding']
            args['use_unicode'] = True

        connection = mysql.connector.connect(**args)
        cursor = connection.cursor()
        cursor.execute("SET SESSION SQL_MODE=ANSI_QUOTES")
        connection.autocommit = False
        print(f"\n✅Connection established successfully.")
        return connection

    except mysql.connector.Error as e:
        print(f"\n❌ Error connecting to the database: {e}")
        return None


def my_database_procedure(connection, db_info):
    # === CONNECT TO DB ===
    conn = sqlite3.connect(ADMIN_FILE)
    cursor = conn.cursor()
    cursor.execute("""UPDATE SYS_PARAMS SET F_LANGUAGE=1""")
    cursor.execute("UPDATE SYS_TASKS SET F_DB_TYPE=4, F_ALIAS= ?, F_LOGIN= ?, F_PASSWORD= ?, F_NAME= ?, F_HOST= ?, F_PORT= ?, F_ENCODING = ?, F_PYTHON_LIBRARY=2, F_ITEM_NAME='demo'", (db_info['database'], db_info['user'], db_info['password'], db_info['database'],db_info['host'], db_info['port'], db_info['encoding']))

    item_id = ITEM_START_ID
    field_id = FIELD_START_ID
    skipped_id = 0

    # Maps
    table_to_item_id = {}
    item_id_to_pk_field_id = {}
    matches = get_table_names(connection)
    if not matches:
        print("❌ No valid CREATE TABLE statements found.")
        exit(1)

    # === INSERT INTO SYS_ITEMS AND SYS_FIELDS ===
    for table_name in matches:
        table_info = get_table_info(connection, table_name)
        
        # 🚫 Skip table if no primary key detected
        if not any(col['pk'] for col in table_info['fields']):
            print(f"❌ Skipping table '{table_name}' — no primary key detected.")
            skipped_id += 1
            continue

        f_table_name = table_name
        f_item_name = table_name.lower()
        f_name = "_".join(part.capitalize() for part in table_name.replace("DEMO_", "").split("_"))

        # ✅ Insert into SYS_ITEMS
        cursor.execute("""
            INSERT INTO SYS_ITEMS (
                id, deleted, task_id, type_id, parent, table_id,
                f_name, f_item_name, f_table_name,
                f_visible, f_soft_delete, f_deleted_flag
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item_id, DELETED, TASK_ID, TYPE_ID, PARENT_ID, TABLE_ID,
            f_name, f_item_name, f_table_name,
            VISIBLE, None, None
        ))

        print(f"[SYS_ITEMS] Inserted {table_name} with id={item_id}")
        table_to_item_id[table_name] = item_id

        field_ids = []
        pk_detected = False

        for col in table_info['fields']:
            col_name = col['col_name']
            col_type = col['col_type']
            col_constraints = col['col_constraints']
            pk = col['pk']

            f_field_name = sanitize_field_name(to_camel_case(col_name))
            f_name = to_caption(col_name)
            f_data_type = get_f_data_type(col_type, col_name)

            # ✅ Insert into SYS_FIELDS
            cursor.execute("""
                INSERT INTO SYS_FIELDS (
                    id, owner_id, task_id, owner_rec_id, deleted,
                    f_field_name, f_db_field_name, f_name, f_data_type, f_required,
                    f_alignment, f_textarea, f_do_not_sanitize, f_calc_lookup_field
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                field_id, OWNER_ID, TASK_ID, item_id, DELETED,
                f_field_name, col_name, f_name, f_data_type, F_REQUIRED,
                F_ALIGNMENT, F_TEXTAREA, F_DO_NOT_SANITIZE, F_CALC_LOOKUP_FIELD
            ))

            print(f"  ↳ [SYS_FIELDS] {col_name} → {f_field_name}, id={field_id}, type={f_data_type}")

            if pk and not pk_detected:
                item_id_to_pk_field_id[item_id] = field_id
                pk_detected = True

            field_ids.append(field_id)
            field_id += 1

        # === BUILD F_INFO JSON ===
        view_section = [[fid, ""] for fid in field_ids]
        edit_section = [
            ["", [[{}, [[fid] for fid in field_ids], ""]]]
        ]
        f_info = {
            "view": {"0": ["", {}, [], {}, view_section, []]},
            "edit": {"0": ["", {}, [], edit_section]},
            "order": [],
            "reports": []
        }
        f_info_str = "json" + json.dumps(f_info)

        cursor.execute("UPDATE SYS_ITEMS SET f_info = ? WHERE id = ?", (f_info_str, item_id))

        item_id += 1


    # === UPDATE SYS_ITEMS WITH f_primary_key ===
    for item_id, pk_field_id in item_id_to_pk_field_id.items():
        cursor.execute("UPDATE SYS_ITEMS SET f_primary_key = ? WHERE id = ?", (pk_field_id, item_id))
        print(f"[SYS_ITEMS] Updated item_id={item_id} with f_primary_key={pk_field_id}")

    # === COMMIT AND CLOSE ===
    conn.commit()
    conn.close()

    print(f"\n🚫 Skipped {skipped_id} items.")
    print(f"\n✅ Inserted {item_id - ITEM_START_ID} items and {field_id - FIELD_START_ID} fields.")

def main():
    parser = argparse.ArgumentParser(description='Connect to MySQL database.')
    parser.add_argument('--database', required=True, help='Database name')
    parser.add_argument('--user', required=True, help='Username')
    parser.add_argument('--password', required=True, help='Password')
    parser.add_argument('--host', default='localhost', help='Host (default: localhost)')
    parser.add_argument('--port', default='3306', help='Port number (default: 3306)')
    parser.add_argument('--encoding', help='Character encoding (e.g., utf8)')

    args = parser.parse_args()

    db_info = vars(args)  # Converts Namespace to dict
    connection = connect_to_database(db_info)
    if connection:
        my_database_procedure(connection,db_info)  # 👈 Call your function here
        connection.close()

if __name__ == '__main__':
    main()
