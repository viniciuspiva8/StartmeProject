SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema DB12
-- -----------------------------------------------------

CREATE SCHEMA IF NOT EXISTS DB12 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
USE DB12;

-- -----------------------------------------------------
-- Table Empresa
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Empresa (
  Id_Empresa INT NOT NULL AUTO_INCREMENT,
  Nome VARCHAR(100) NOT NULL,
  Area VARCHAR(100) NOT NULL,
  CNPJ VARCHAR(18) NOT NULL,
  Endereco VARCHAR(150) NOT NULL,
  Email VARCHAR(100) NOT NULL,
  Telefone VARCHAR(20) NOT NULL,
  PRIMARY KEY (Id_Empresa)
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table Instituicao
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Instituicao (
  Id_Instituicao INT NOT NULL AUTO_INCREMENT,
  Nome VARCHAR(100) NOT NULL,
  Tipo VARCHAR(50) NOT NULL,
  CNPJ VARCHAR(18) NOT NULL,
  Area_Atuacao VARCHAR(100) NOT NULL,
  Pais VARCHAR(50) NOT NULL,
  Estado VARCHAR(50) NOT NULL,
  Cidade VARCHAR(50) NOT NULL,
  Endereco VARCHAR(150) NOT NULL,
  Telefone VARCHAR(20) NOT NULL,
  Email VARCHAR(100) NOT NULL,
  PRIMARY KEY (Id_Instituicao)
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table Curso
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Curso (
  Id_Curso INT NOT NULL AUTO_INCREMENT,
  Nome VARCHAR(100) NOT NULL,
  Carga_Horaria INT NOT NULL,
  Descricao LONGTEXT NOT NULL,
  Qtd_Semestre INT NOT NULL,
  Id_Instituicao INT NOT NULL,
  PRIMARY KEY (Id_Curso),
  INDEX fk_Curso_Instituicao_idx (Id_Instituicao ASC),
  CONSTRAINT fk_Curso_Instituicao
    FOREIGN KEY (Id_Instituicao)
    REFERENCES Instituicao (Id_Instituicao)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB;

-- -----------------------------------------------------
-- Table Aluno
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Aluno (
  Id_Aluno INT NOT NULL AUTO_INCREMENT,
  Nome VARCHAR(100) NOT NULL,
  CPF VARCHAR(14) NOT NULL UNIQUE,
  RG VARCHAR(20) NOT NULL,
  Idade INT NOT NULL CHECK (Idade > 0),
  Data_Nascimento DATE NOT NULL,
  Semestre INT NOT NULL CHECK (Semestre >= 1),
  Id_Curso INT NOT NULL,
  PRIMARY KEY (Id_Aluno),
  INDEX fk_Aluno_Curso_idx (Id_Curso ASC),
  CONSTRAINT fk_Aluno_Curso
    FOREIGN KEY (Id_Curso)
    REFERENCES Curso (Id_Curso)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB;


-- -----------------------------------------------------
-- Table Vagas
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS Vagas (
  Id_Vaga INT NOT NULL AUTO_INCREMENT,
  Titulo VARCHAR(100) NOT NULL,
  Descricao LONGTEXT NOT NULL,
  Salario DECIMAL(10,2) NOT NULL,
  Id_Empresa INT NOT NULL,
  PRIMARY KEY (Id_Vaga),
  INDEX fk_Vagas_Empresa_idx (Id_Empresa ASC),
  CONSTRAINT fk_Vagas_Empresa
    FOREIGN KEY (Id_Empresa)
    REFERENCES Empresa (Id_Empresa)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE = InnoDB;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

