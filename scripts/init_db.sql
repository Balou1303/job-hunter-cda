-- Création de la base de données
CREATE DATABASE IF NOT EXISTS alternance;
USE alternance;

-- 1. Table des sources
CREATE TABLE IF NOT EXISTS sources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    base_url VARCHAR(255)
);

INSERT IGNORE INTO sources (id, name, base_url) VALUES (1, 'France Travail', 'https://www.francetravail.fr');

-- 2. Table des offres d'alternance
CREATE TABLE IF NOT EXISTS job_offers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    source_id VARCHAR(255) UNIQUE, 
    source_db_id INT DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    location VARCHAR(255),
    link TEXT,
    description TEXT,
    score_ai INT DEFAULT NULL,
    analyse_ia TEXT DEFAULT NULL,
    status VARCHAR(50) DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (source_db_id) REFERENCES sources(id)
);

-- 3. Table des candidatures
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    job_offer_id INT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    notes TEXT,
    reminder_date DATETIME,
    FOREIGN KEY (job_offer_id) REFERENCES job_offers(id) ON DELETE CASCADE
);

-- 4. Profil candidat, lu par le workflow n8n (node "Profil candidat").
-- Une seule ligne attendue. Le schema est generique et versionne ; son contenu (personnel) ne l'est
-- pas - voir la section Installation du README pour l'INSERT a executer localement.
CREATE TABLE IF NOT EXISTS candidate_profile (
    id INT AUTO_INCREMENT PRIMARY KEY,
    profil TEXT NOT NULL,
    telegram_chat_id VARCHAR(50) NOT NULL
);
