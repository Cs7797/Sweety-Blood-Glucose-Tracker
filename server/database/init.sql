CREATE TABLE IF NOT EXISTS users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(80) NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
    email VARCHAR(254) NOT NULL UNIQUE CHECK (email = lower(btrim(email)) AND char_length(email) > 3),
    password TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
