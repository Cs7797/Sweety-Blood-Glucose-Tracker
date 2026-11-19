CREATE TABLE IF NOT EXISTS users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(80) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND char_length(email) > 3),
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS readings (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reading_date DATE NOT NULL CHECK (reading_date >= DATE '0001-01-01'),
    slot TEXT NOT NULL CHECK (slot IN (
        'Morning (fasting)',
        'After breakfast',
        'After lunch',
        'After dinner'
    )),
    glucose INTEGER NOT NULL CHECK (glucose BETWEEN 40 AND 600),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT readings_user_date_slot_key UNIQUE (user_id, reading_date, slot)
);
