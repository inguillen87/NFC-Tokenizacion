CREATE TABLE IF NOT EXISTS knowledge_articles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(locale, slug)
);

CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  company text,
  country text,
  vertical text,
  tag_type text,
  volume integer,
  source text NOT NULL DEFAULT 'assistant',
  status text NOT NULL DEFAULT 'new',
  notes text,
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  title text NOT NULL,
  detail text,
  status text NOT NULL DEFAULT 'open',
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS order_requests (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  locale text NOT NULL DEFAULT 'es-AR',
  contact text NOT NULL,
  company text,
  tag_type text,
  volume integer,
  notes text,
  status text NOT NULL DEFAULT 'new',
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);
