
/*=========================================================
        BASE DE DATOS GAMIFICACIÓN THERMOFISHER
        PostgreSQL
=========================================================*/

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

/*=========================================================
        ELIMINAR TABLAS
=========================================================*/

DROP TABLE IF EXISTS respuestas_usuario CASCADE;
DROP TABLE IF EXISTS usuario_logro CASCADE;
DROP TABLE IF EXISTS logros CASCADE;
DROP TABLE IF EXISTS ranking CASCADE;
DROP TABLE IF EXISTS progreso_usuario CASCADE;
DROP TABLE IF EXISTS opciones_respuesta CASCADE;
DROP TABLE IF EXISTS preguntas CASCADE;
DROP TABLE IF EXISTS niveles CASCADE;
DROP TABLE IF EXISTS mundos CASCADE;
DROP TABLE IF EXISTS registro_sesion CASCADE;
DROP TABLE IF EXISTS perfiles CASCADE;
DROP TABLE IF EXISTS equipos CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;


/*=========================================================
                TABLA USUARIOS
=========================================================*/

CREATE TABLE usuarios(

    id_usuario BIGINT GENERATED ALWAYS AS IDENTITY,

    correo VARCHAR(150) NOT NULL,

    contrasena VARCHAR(255) NOT NULL,

    rol VARCHAR(20) NOT NULL DEFAULT 'usuario',

    estado VARCHAR(20) NOT NULL DEFAULT 'activo',

    fecha_creacion TIMESTAMP DEFAULT NOW(),

    CONSTRAINT pk_usuarios
        PRIMARY KEY(id_usuario),

    CONSTRAINT uq_usuario_correo
        UNIQUE(correo),

    CONSTRAINT chk_rol
        CHECK (rol IN ('administrador','usuario')),

    CONSTRAINT chk_estado
        CHECK (estado IN ('activo','inactivo'))

);


INSERT INTO usuarios (
    correo,
    contrasena,
    rol,
    estado
)
VALUES (
    'admin@thermofisher.com',
    'ThermoAdmin2026',
    'administrador',
    'activo'
)
RETURNING id_usuario;


INSERT INTO perfiles (
    id_usuario,
    nombre,
    apellidos,
    edad,
    id_equipo,
    avatar_url
)
VALUES (
    19,
    'Administrador',
    'General',
    30,
    7,
    NULL
);


INSERT INTO usuarios (
    correo,
    contrasena,
    rol,
    estado
)
VALUES
(
    'guillermo.sanchez@thermofisher.com',
    'ScFiTh6591',
    'administrador',
    'activo'
),
(
    'nicole.solorzano@thermofisher.com',
    'ScFiTh6591',
    'administrador',
    'activo'
),
(
    'flavio.olivieri@thermofisher.com',
    'ScFiTh6591',
    'administrador',
    'activo'
);





/*=========================================================
                TABLA EQUIPOS
=========================================================*/

CREATE TABLE equipos(

    id_equipo BIGINT GENERATED ALWAYS AS IDENTITY,

    nombre VARCHAR(100) NOT NULL,

    mascota VARCHAR(100) NOT NULL,

    descripcion TEXT,

    codigo VARCHAR(20) UNIQUE,

    activo BOOLEAN DEFAULT TRUE,

    CONSTRAINT pk_equipos
        PRIMARY KEY(id_equipo),

    CONSTRAINT uq_equipo
        UNIQUE(nombre)

);

UPDATE equipos SET nombre = 'Amarok' WHERE id_equipo = 9;

UPDATE equipos SET nombre = 'Crows' WHERE id_equipo = 10;

UPDATE equipos SET nombre = 'Magma' WHERE id_equipo = 11;

UPDATE equipos SET nombre = 'Vanguards' WHERE id_equipo = 12;

UPDATE equipos SET nombre = 'Alebrijes' WHERE id_equipo = 13;

UPDATE equipos SET nombre = 'Tiger Sharks' WHERE id_equipo = 14;

UPDATE equipos SET nombre = 'Kairos' WHERE id_equipo = 15;

UPDATE equipos SET nombre = 'Cloud Doges' WHERE id_equipo = 16;

UPDATE equipos SET nombre = 'Team Rocket' WHERE id_equipo = 17;

UPDATE equipos SET nombre = 'Camaleones' WHERE id_equipo = 18;

UPDATE equipos SET nombre = 'Looney Tunes' WHERE id_equipo = 19;

UPDATE equipos SET nombre = 'Dragonflies' WHERE id_equipo = 20;

UPDATE equipos SET nombre = 'Saguaros' WHERE id_equipo = 24;

UPDATE equipos SET nombre = 'Hippogriffs' WHERE id_equipo = 27;

UPDATE equipos SET nombre = 'Unicorns' WHERE id_equipo = 28;

INSERT INTO equipos (nombre, mascota)
VALUES
('IT COE MX Team', 'IT COE MX Team'),
('Staff IT COE MX', 'Staff IT COE MX');


ALTER TABLE equipos
ADD COLUMN racha INTEGER DEFAULT 0;


/*=========================================================
                TABLA PERFILES
=========================================================*/

CREATE TABLE perfiles(

    id_perfil UUID DEFAULT gen_random_uuid(),

    id_usuario BIGINT NOT NULL,

    nombre VARCHAR(80) NOT NULL,

    apellidos VARCHAR(80) NOT NULL,

    edad INTEGER NOT NULL,

    id_equipo BIGINT NOT NULL,

    avatar_url TEXT,

    fecha_registro TIMESTAMP DEFAULT NOW(),

    CONSTRAINT pk_perfiles
        PRIMARY KEY(id_perfil),

    CONSTRAINT fk_perfil_usuario
        FOREIGN KEY(id_usuario)
        REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_perfil_equipo
        FOREIGN KEY(id_equipo)
        REFERENCES equipos(id_equipo)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,

    CONSTRAINT chk_edad
        CHECK (edad >= 18)

);



INSERT INTO perfiles
(
    id_usuario,
    nombre,
    apellidos,
    edad,
    id_equipo,
    avatar_url
)
VALUES
(
    29,
    'Guillermo',
    'Sanchez',
    30,
    31,
    NULL
),
(
    30,
    'Nicole',
    'Solorzano',
    30,
    31,
    NULL
),
(
    31,
    'Flavio',
    'Olivieri',
    30,
    31,
    NULL
);





/*=========================================================
            TABLA REGISTRO DE SESIÓN
=========================================================*/

CREATE TABLE registro_sesion(

    id_registro BIGINT GENERATED ALWAYS AS IDENTITY,

    id_usuario BIGINT NOT NULL,

    fecha_inicio TIMESTAMP DEFAULT NOW(),

    fecha_cierre TIMESTAMP,

    direccion_ip VARCHAR(45),

    dispositivo VARCHAR(100),

    estado VARCHAR(20) DEFAULT 'activo',

    CONSTRAINT pk_registro_sesion
        PRIMARY KEY(id_registro),

    CONSTRAINT fk_registro_usuario
        FOREIGN KEY(id_usuario)
        REFERENCES usuarios(id_usuario)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT chk_estado_sesion
        CHECK (estado IN ('activo','cerrado'))

);

INSERT INTO usuarios(correo, contrasena)
VALUES('oscar@test.com','123456');

INSERT INTO perfiles(
id_usuario,
nombre,
apellidos,
edad,
id_equipo
)
VALUES(
1,
'Oscar',
'Torres',
22,
1
);

/*=========================================================
                TABLA MUNDOS
=========================================================*/

CREATE TABLE mundos(

    id_mundo BIGINT GENERATED ALWAYS AS IDENTITY,

    nombre VARCHAR(100) NOT NULL,

    descripcion TEXT,

    imagen TEXT,

    orden INTEGER NOT NULL,

    activo BOOLEAN DEFAULT TRUE,

    CONSTRAINT pk_mundos
        PRIMARY KEY(id_mundo),

    CONSTRAINT uq_mundo
        UNIQUE(nombre),

    CONSTRAINT uq_orden_mundo
        UNIQUE(orden)

);

INSERT INTO mundos(nombre, descripcion, orden)
VALUES
('Seguridad','Capacitación de seguridad',1),
('Calidad','Capacitación de calidad',2);

/*=========================================================
                TABLA NIVELES
=========================================================*/

CREATE TABLE niveles(

    id_nivel BIGINT GENERATED ALWAYS AS IDENTITY,

    id_mundo BIGINT NOT NULL,

    nombre VARCHAR(100) NOT NULL,

    descripcion TEXT,

    orden INTEGER NOT NULL,

    puntos_requeridos INTEGER DEFAULT 0,

    activo BOOLEAN DEFAULT TRUE,

    CONSTRAINT pk_niveles
        PRIMARY KEY(id_nivel),

    CONSTRAINT fk_niveles_mundo
        FOREIGN KEY(id_mundo)
        REFERENCES mundos(id_mundo)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_nivel
        UNIQUE(id_mundo, orden)

);

INSERT INTO niveles(id_mundo,nombre,orden)
VALUES
(1,'Nivel 1',1),
(1,'Nivel 2',2);

/*=========================================================
                TABLA PREGUNTAS
=========================================================*/

CREATE TABLE preguntas(

    id_pregunta BIGINT GENERATED ALWAYS AS IDENTITY,

    id_nivel BIGINT NOT NULL,

    caso TEXT NOT NULL,

    pregunta TEXT NOT NULL,

    tipo VARCHAR(30) NOT NULL DEFAULT 'Opcion Multiple',

    dificultad VARCHAR(20) NOT NULL,

    puntos INTEGER DEFAULT 10,

    activo BOOLEAN DEFAULT TRUE,

    fecha_creacion TIMESTAMP DEFAULT NOW(),

    CONSTRAINT pk_preguntas
        PRIMARY KEY(id_pregunta),

    CONSTRAINT fk_preguntas_nivel
        FOREIGN KEY(id_nivel)
        REFERENCES niveles(id_nivel)
        ON UPDATE CASCADE
        ON DELETE CASCADE

);


INSERT INTO preguntas(
    id_nivel,
    caso,
    pregunta,
    dificultad
)
VALUES(
    1,
    'Un empleado entra al laboratorio sin lentes de seguridad.',
    '¿Qué debe hacer primero?',
    'Facil'
);

/*=========================================================
            TABLA OPCIONES_RESPUESTA
=========================================================*/

CREATE TABLE opciones_respuesta(

    id_opcion BIGINT GENERATED ALWAYS AS IDENTITY,

    id_pregunta BIGINT NOT NULL,

    texto_opcion TEXT NOT NULL,

    orden SMALLINT NOT NULL,

    es_correcta BOOLEAN DEFAULT FALSE,

    CONSTRAINT pk_opciones
        PRIMARY KEY(id_opcion),

    CONSTRAINT fk_opcion_pregunta
        FOREIGN KEY(id_pregunta)
        REFERENCES preguntas(id_pregunta)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT chk_orden
        CHECK (orden BETWEEN 1 AND 4),

    CONSTRAINT uq_opcion
        UNIQUE(id_pregunta, orden)

);

INSERT INTO opciones_respuesta
(id_pregunta, texto_opcion, orden, es_correcta)
VALUES
(1,'Colocarse los lentes de seguridad',1,TRUE),
(1,'Entrar sin protección',2,FALSE),
(1,'Esperar al supervisor',3,FALSE),
(1,'Ignorar el procedimiento',4,FALSE);


/*=========================================================
            TABLA RESPUESTAS_USUARIO
=========================================================*/

CREATE TABLE respuestas_usuario(

    id_respuesta BIGINT GENERATED ALWAYS AS IDENTITY,

    id_perfil UUID NOT NULL,

    id_pregunta BIGINT NOT NULL,

    id_opcion BIGINT NOT NULL,

    es_correcta BOOLEAN NOT NULL,

    puntos_obtenidos INTEGER DEFAULT 0,

    tiempo_segundos INTEGER,

    fecha_respuesta TIMESTAMP DEFAULT NOW(),

    CONSTRAINT pk_respuestas_usuario
        PRIMARY KEY(id_respuesta),

    CONSTRAINT fk_respuesta_perfil
        FOREIGN KEY(id_perfil)
        REFERENCES perfiles(id_perfil)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_respuesta_pregunta
        FOREIGN KEY(id_pregunta)
        REFERENCES preguntas(id_pregunta)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_respuesta_opcion
        FOREIGN KEY(id_opcion)
        REFERENCES opciones_respuesta(id_opcion)
        ON UPDATE CASCADE
        ON DELETE CASCADE

);

/*=========================================================
            TABLA PROGRESO_USUARIO
=========================================================*/

CREATE TABLE progreso_usuario(

    id_progreso BIGINT GENERATED ALWAYS AS IDENTITY,

    id_perfil UUID NOT NULL,

    id_nivel BIGINT NOT NULL,

    experiencia INTEGER DEFAULT 0,

    monedas INTEGER DEFAULT 0,

    racha INTEGER DEFAULT 0,

    porcentaje NUMERIC(5,2) DEFAULT 0,

    completado BOOLEAN DEFAULT FALSE,

    fecha_actualizacion TIMESTAMP DEFAULT NOW(),

    CONSTRAINT pk_progreso_usuario
        PRIMARY KEY(id_progreso),

    CONSTRAINT fk_progreso_perfil
        FOREIGN KEY(id_perfil)
        REFERENCES perfiles(id_perfil)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_progreso_nivel
        FOREIGN KEY(id_nivel)
        REFERENCES niveles(id_nivel)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_progreso
        UNIQUE(id_perfil,id_nivel)

);

/*=========================================================
                    TABLA LOGROS
=========================================================*/

CREATE TABLE logros(

    id_logro BIGINT GENERATED ALWAYS AS IDENTITY,

    nombre VARCHAR(100) NOT NULL,

    descripcion TEXT,

    puntos_recompensa INTEGER DEFAULT 0,

    moneda_recompensa INTEGER DEFAULT 0,

    activo BOOLEAN DEFAULT TRUE,

    CONSTRAINT pk_logros
        PRIMARY KEY(id_logro),

    CONSTRAINT uq_logro_nombre
        UNIQUE(nombre)

);

/*=========================================================
                TABLA USUARIO_LOGRO
=========================================================*/

CREATE TABLE usuario_logro(

    id_usuario_logro BIGINT GENERATED ALWAYS AS IDENTITY,

    id_perfil UUID NOT NULL,

    id_logro BIGINT NOT NULL,

    fecha_obtenido TIMESTAMP DEFAULT NOW(),

    CONSTRAINT pk_usuario_logro
        PRIMARY KEY(id_usuario_logro),

    CONSTRAINT fk_usuario_logro_perfil
        FOREIGN KEY(id_perfil)
        REFERENCES perfiles(id_perfil)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_logro_logro
        FOREIGN KEY(id_logro)
        REFERENCES logros(id_logro)
        ON UPDATE CASCADE
        ON DELETE CASCADE,

    CONSTRAINT uq_logro_usuario
        UNIQUE(id_perfil, id_logro)

);

DELETE FROM equipos;
DELETE FROM usuarios;


/*=========================================================
        CODIGOS_AYUDa
=========================================================*/

CREATE TABLE codigos_ayuda(

    id_codigo INTEGER GENERATED ALWAYS AS IDENTITY,

    codigo VARCHAR(20) NOT NULL,

    id_usuario_creador BIGINT NOT NULL,

    id_mundo BIGINT NOT NULL,

    id_nivel BIGINT NOT NULL,

    ayudas_requeridas INTEGER NOT NULL,

    ayudas_recibidas INTEGER NOT NULL DEFAULT 0,

    estado VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',

    fecha_creacion TIMESTAMP DEFAULT NOW(),

    CONSTRAINT codigos_ayuda_pkey
        PRIMARY KEY(id_codigo),

    CONSTRAINT codigos_ayuda_codigo_key
        UNIQUE(codigo),

    CONSTRAINT codigos_ayuda_estado_check
        CHECK (estado IN ('PENDIENTE','COMPLETADO')),

    CONSTRAINT fk_codigo_usuario
        FOREIGN KEY(id_usuario_creador)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT fk_codigo_mundo
        FOREIGN KEY(id_mundo)
        REFERENCES mundos(id_mundo)
        ON DELETE CASCADE,

    CONSTRAINT fk_codigo_nivel
        FOREIGN KEY(id_nivel)
        REFERENCES niveles(id_nivel)
        ON DELETE CASCADE

);


/*=========================================================
        Ayudas realizada 
=========================================================*/

CREATE TABLE ayudas_realizadas(

    id_ayuda INTEGER GENERATED ALWAYS AS IDENTITY,

    id_codigo INTEGER NOT NULL,

    id_usuario_ayudante BIGINT NOT NULL,

    fecha TIMESTAMP DEFAULT NOW(),

    id_equipo INTEGER,

    CONSTRAINT ayudas_realizadas_pkey
        PRIMARY KEY(id_ayuda),

    CONSTRAINT ayuda_unica
        UNIQUE(id_codigo,id_usuario_ayudante),

    CONSTRAINT fk_ayuda_codigo
        FOREIGN KEY(id_codigo)
        REFERENCES codigos_ayuda(id_codigo)
        ON DELETE CASCADE,

    CONSTRAINT fk_ayuda_usuario
        FOREIGN KEY(id_usuario_ayudante)
        REFERENCES usuarios(id_usuario)
        ON DELETE CASCADE,

    CONSTRAINT fk_ayudas_equipo
        FOREIGN KEY(id_equipo)
        REFERENCES equipos(id_equipo)
        ON DELETE CASCADE

);




