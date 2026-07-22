<?php
/**
 * Copy to public_html/nf-cms/config.php and edit.
 *
 * DATA_FILE: upload your cms/data/store.json here (or keep outside public_html).
 * JWT_SECRET: long random string (same idea as Node CMS).
 */
return [
    // Absolute path recommended. Example for your account:
    // '/home/nerdzfa1/nf-cms-data/store.json'
    'DATA_FILE' => __DIR__ . '/data/store.json',

    // Writable folder for opportunity images (create it in File Manager)
    'UPLOAD_DIR' => dirname(__DIR__) . '/uploads/opportunities',

    // Public URL path for those images
    'UPLOAD_URL' => '/uploads/opportunities',

    'JWT_SECRET' => 'CHANGE-ME-TO-A-LONG-RANDOM-SECRET',

    // Default admin if store.json has no users yet
    'BOOTSTRAP_ADMIN_EMAIL' => 'admin@nerdzfactory.org',
    'BOOTSTRAP_ADMIN_PASSWORD' => 'changeme123',
    'BOOTSTRAP_ADMIN_NAME' => 'Admin',
];
