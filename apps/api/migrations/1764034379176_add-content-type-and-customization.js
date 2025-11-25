/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const up = (pgm) => {
  // Add content_type column for QR content types
  pgm.addColumn('urls', {
    content_type: {
      type: 'VARCHAR(32)',
      default: 'url',
      notNull: true
    }
  });

  // Add qr_config column for QR customization (colors, error correction, etc.)
  pgm.addColumn('urls', {
    qr_config: {
      type: 'JSONB',
      default: '{}'
    }
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
export const down = (pgm) => {
  pgm.dropColumn('urls', 'content_type');
  pgm.dropColumn('urls', 'qr_config', { ifExists: true });
};
