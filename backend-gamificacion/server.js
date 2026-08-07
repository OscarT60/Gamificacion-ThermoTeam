require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const bcrypt = require("bcrypt");
const app = express();

app.use(cors());
app.use(express.json());

function generarCodigo() {
    const numero = Math.floor(1000 + Math.random() * 9000);
    return `CW-${numero}`;
}



app.get("/equipos", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT * FROM equipos"
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al obtener equipos"
        });
    }
});

app.get("/mundos", async (req, res) => {
    try {
        const resultado = await pool.query(
            "SELECT * FROM mundos ORDER BY orden"
        );

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al obtener mundos"
        });
    }
});

app.post("/mundos", async (req, res) => {

    try {

        const { nombre, descripcion } = req.body;

        // Verificar límite de 14 mundos
        const cantidadMundos = await pool.query(
            "SELECT COUNT(*) AS total FROM mundos"
        );

        if (parseInt(cantidadMundos.rows[0].total) >= 14) {
            return res.status(400).json({
                error: "Ya existe el máximo de 14 mundos permitidos"
            });
        }

        // Crear mundo
        const resultado = await pool.query(
            `INSERT INTO mundos
            (
                nombre,
                descripcion,
                orden,
                activo
            )
            VALUES (
                $1,
                $2,
                COALESCE(
                    (SELECT MAX(orden) + 1 FROM mundos),
                    1
                ),
                true
            )
            RETURNING *`,
            [nombre, descripcion]
        );

        const mundo = resultado.rows[0];
        const id_mundo = mundo.id_mundo;

        // Crear automáticamente los 4 niveles
        for (let i = 1; i <= 4; i++) {

            await pool.query(
                `INSERT INTO niveles
                (
                    id_mundo,
                    nombre,
                    descripcion,
                    orden,
                    puntos_requeridos,
                    activo
                )
                VALUES (
                    $1,
                    $2,
                    $3,
                    $4,
                    0,
                    true
                )`,
                [
                    id_mundo,
                    `Nivel ${i}`,
                    `Nivel ${i} del mundo ${nombre}`,
                    i
                ]
            );

        }

        res.status(201).json({
            mensaje: "Mundo y niveles creados correctamente",
            mundo
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al crear mundo"
        });

    }

});

app.delete("/mundos/:nombre", async (req, res) => {

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const { nombre } = req.params;

        // Buscar el mundo
        const mundo = await client.query(
            `SELECT id_mundo
             FROM mundos
             WHERE nombre = $1`,
            [nombre]
        );

        if (mundo.rows.length === 0) {

            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Mundo no encontrado"
            });

        }

        const id_mundo = mundo.rows[0].id_mundo;

        // Eliminar ayudas realizadas de los códigos de ese mundo
        await client.query(
            `DELETE FROM ayudas_realizadas
             WHERE id_codigo IN (
                SELECT id_codigo
                FROM codigos_ayuda
                WHERE id_mundo = $1
             )`,
            [id_mundo]
        );

        // Eliminar códigos de ayuda
        await client.query(
            `DELETE FROM codigos_ayuda
             WHERE id_mundo = $1`,
            [id_mundo]
        );

        // Eliminar el mundo
        // Los niveles y preguntas se eliminan automáticamente
        // porque ya tienen ON DELETE CASCADE
        const eliminado = await client.query(
            `DELETE FROM mundos
             WHERE id_mundo = $1
             RETURNING *`,
            [id_mundo]
        );

        await client.query("COMMIT");

        res.json({
            mensaje: "Mundo eliminado correctamente",
            mundo: eliminado.rows[0]
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.error(error);

        res.status(500).json({
            error: "Error al eliminar mundo"
        });

    } finally {

        client.release();

    }

});




app.get("/niveles", async (req, res) => {
    try {
        const resultado = await pool.query(`
            SELECT
                n.id_nivel,
                n.id_mundo,
                n.nombre,
                n.descripcion,
                n.orden,
                m.nombre AS mundo
            FROM niveles n
            JOIN mundos m
                ON n.id_mundo = m.id_mundo
            ORDER BY m.orden, n.orden
        `);

        res.json(resultado.rows);

    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Error al obtener niveles"
        });
    }
});

app.get("/preguntas", async (req, res) => {

    try {

        const resultado = await pool.query(`
            SELECT
                p.id_pregunta,
                n.id_nivel,
                m.id_mundo,

                p.caso,
                p.pregunta,

                n.nombre AS nivel,
                m.nombre AS mundo,

                MAX(CASE
                    WHEN o.es_correcta = true
                    THEN o.texto_opcion
                END) AS correcta,

                MAX(CASE
                    WHEN o.es_correcta = false
                    AND o.orden = 2
                    THEN o.texto_opcion
                END) AS incorrecta1,

                MAX(CASE
                    WHEN o.es_correcta = false
                    AND o.orden = 3
                    THEN o.texto_opcion
                END) AS incorrecta2,

                MAX(CASE
                    WHEN o.es_correcta = false
                    AND o.orden = 4
                    THEN o.texto_opcion
                END) AS incorrecta3

            FROM preguntas p

            JOIN niveles n
                ON p.id_nivel = n.id_nivel

            JOIN mundos m
                ON n.id_mundo = m.id_mundo

            LEFT JOIN opciones_respuesta o
                ON p.id_pregunta = o.id_pregunta

            GROUP BY
                p.id_pregunta,
                n.id_nivel,
                m.id_mundo,
                p.caso,
                p.pregunta,
                n.nombre,
                m.nombre

            ORDER BY p.id_pregunta
        `);

        res.json(resultado.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al obtener preguntas"
        });

    }

});

app.post("/preguntas", async (req, res) => {

    try {

        const {
            mundo,
            nivel,
            caso,
            pregunta,
            correcta,
            incorrecta1,
            incorrecta2,
            incorrecta3
        } = req.body;

        // Buscar el nivel correspondiente
        const nivelResultado = await pool.query(
            `SELECT n.id_nivel
             FROM niveles n
             JOIN mundos m
                ON n.id_mundo = m.id_mundo
             WHERE m.nombre = $1
             AND n.nombre = $2`,
            [mundo, nivel]
        );

        if (nivelResultado.rows.length === 0) {
            return res.status(404).json({
                error: "Nivel no encontrado"
            });
        }

        const id_nivel = nivelResultado.rows[0].id_nivel;

        // Revisar si ya existe pregunta para ese nivel
        const preguntaExistente = await pool.query(
            `SELECT id_pregunta
             FROM preguntas
             WHERE id_nivel = $1`,
            [id_nivel]
        );

        let id_pregunta;

        if (preguntaExistente.rows.length > 0) {

            // UPDATE
            id_pregunta = preguntaExistente.rows[0].id_pregunta;

            await pool.query(
                `UPDATE preguntas
                 SET caso = $1,
                     pregunta = $2
                 WHERE id_pregunta = $3`,
                [caso, pregunta, id_pregunta]
            );

            // Borrar respuestas viejas
            await pool.query(
                `DELETE FROM opciones_respuesta
                 WHERE id_pregunta = $1`,
                [id_pregunta]
            );

        } else {

            // INSERT
            const nuevaPregunta = await pool.query(
                `INSERT INTO preguntas
                (
                    id_nivel,
                    caso,
                    pregunta,
                    tipo,
                    dificultad,
                    puntos,
                    activo
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    'multiple',
                    'media',
                    10,
                    true
                )
                RETURNING id_pregunta`,
                [
                    id_nivel,
                    caso,
                    pregunta
                ]
            );

            id_pregunta = nuevaPregunta.rows[0].id_pregunta;
        }

        // Guardar respuestas
        await pool.query(
            `INSERT INTO opciones_respuesta
            (
                id_pregunta,
                texto_opcion,
                orden,
                es_correcta
            )
            VALUES
            ($1,$2,1,true),
            ($1,$3,2,false),
            ($1,$4,3,false),
            ($1,$5,4,false)`,
            [
                id_pregunta,
                correcta,
                incorrecta1,
                incorrecta2,
                incorrecta3
            ]
        );

        res.status(200).json({
            mensaje: "Pregunta guardada correctamente"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al guardar pregunta"
        });

    }

});



app.post("/registro", async (req, res) => {

    try {

        const {
            nombre,
            apellidos,
            correo,
            contrasena,
            id_equipo
        } = req.body;

        // Edad por defecto porque ya no existe en el formulario
        const edad = 21;
        const contrasenaEncriptada = await bcrypt.hash(contrasena, 10);

        // Insertar usuario
        const usuario = await pool.query(
            `INSERT INTO usuarios
            (correo, contrasena)
            VALUES ($1, $2)
            RETURNING id_usuario`,
            [correo, contrasenaEncriptada]
        );

        const id_usuario = usuario.rows[0].id_usuario;

        // Insertar perfil
        await pool.query(
            `INSERT INTO perfiles
            (id_usuario, nombre, apellidos, edad, id_equipo)
            VALUES ($1, $2, $3, $4, $5)`,
            [id_usuario, nombre, apellidos, edad, id_equipo]
        );

        res.status(201).json({
            mensaje: "Usuario registrado correctamente"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al registrar usuario"
        });

    }

});

app.post("/login", async (req, res) => {

    try {

        const { correo, contrasena } = req.body;

        const resultado = await pool.query(
            `SELECT
                u.id_usuario,
                u.correo,
                u.contrasena,
                u.rol,
                u.estado,
                p.nombre,
                p.apellidos,
                p.id_equipo
             FROM usuarios u
             JOIN perfiles p
                ON u.id_usuario = p.id_usuario
             WHERE u.correo = $1`,
            [correo]
        );

        if (resultado.rows.length === 0) {
            return res.status(401).json({
                error: "Correo o contraseña incorrectos"
            });
        }

        const usuario = resultado.rows[0];

        const coincide = await bcrypt.compare(
            contrasena,
            usuario.contrasena
        );

        if (!coincide) {
            return res.status(401).json({
                error: "Correo o contraseña incorrectos"
            });
        }

        // No enviar el hash de la contraseña al cliente
        delete usuario.contrasena;

        res.json({
            mensaje: "Login correcto",
            ...usuario
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error en el login"
        });

    }

});

app.get("/opciones/:idPregunta", async (req, res) => {

    try {

        const { idPregunta } = req.params;

        const resultado = await pool.query(
            `SELECT
                id_opcion,
                texto_opcion,
                orden
             FROM opciones_respuesta
             WHERE id_pregunta = $1
             ORDER BY orden`,
            [idPregunta]
        );

        res.json(resultado.rows);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al obtener opciones"
        });

    }

});

app.post("/respuesta", async (req, res) => {

    try {

        const {
            id_perfil,
            id_pregunta,
            id_opcion
        } = req.body;

        // Buscar la opción elegida
        const opcion = await pool.query(
            `SELECT
                es_correcta
             FROM opciones_respuesta
             WHERE id_opcion = $1`,
            [id_opcion]
        );

        if (opcion.rows.length === 0) {
            return res.status(404).json({
                error: "La opción no existe"
            });
        }

        const es_correcta = opcion.rows[0].es_correcta;

        // Buscar los puntos de la pregunta
        const pregunta = await pool.query(
            `SELECT
                puntos
             FROM preguntas
             WHERE id_pregunta = $1`,
            [id_pregunta]
        );

        if (pregunta.rows.length === 0) {
            return res.status(404).json({
                error: "La pregunta no existe"
            });
        }

        const puntos = es_correcta
            ? pregunta.rows[0].puntos
            : 0;

        // Guardar la respuesta
        await pool.query(
            `INSERT INTO respuestas_usuario
            (
                id_perfil,
                id_pregunta,
                id_opcion,
                es_correcta,
                puntos_obtenidos
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5
            )`,
            [
                id_perfil,
                id_pregunta,
                id_opcion,
                es_correcta,
                puntos
            ]
        );

        // Obtener el nivel al que pertenece la pregunta
        const nivel = await pool.query(
            `SELECT id_nivel
             FROM preguntas
             WHERE id_pregunta = $1`,
            [id_pregunta]
        );

        const id_nivel = nivel.rows[0].id_nivel;

        console.log("Nivel encontrado:", id_nivel);

        // Verificar si ya existe progreso
        const progreso = await pool.query(
            `SELECT *
             FROM progreso_usuario
             WHERE id_perfil = $1
             AND id_nivel = $2`,
            [id_perfil, id_nivel]
        );

        if (progreso.rows.length === 0) {

            // Crear progreso
            await pool.query(
                `INSERT INTO progreso_usuario
                (
                    id_perfil,
                    id_nivel,
                    experiencia,
                    monedas,
                    racha,
                    porcentaje,
                    completado
                )
                VALUES
                (
                    $1,
                    $2,
                    $3,
                    0,
                    0,
                    0,
                    false
                )`,
                [
                    id_perfil,
                    id_nivel,
                    puntos
                ]
            );

            console.log("Progreso creado");

        } else {

            // Actualizar experiencia
            await pool.query(
                `UPDATE progreso_usuario
                 SET experiencia = experiencia + $1,
                     fecha_actualizacion = CURRENT_TIMESTAMP
                 WHERE id_perfil = $2
                 AND id_nivel = $3`,
                [
                    puntos,
                    id_perfil,
                    id_nivel
                ]
            );

            console.log("Experiencia actualizada");

        }

        // Obtener el equipo del jugador
        const equipo = await pool.query(
            `SELECT id_equipo
             FROM perfiles
             WHERE id_perfil = $1`,
            [id_perfil]
        );

        // Solo sumar puntos al equipo si respondió correctamente
        if (equipo.rows.length > 0 && es_correcta) {

            const id_equipo = equipo.rows[0].id_equipo;

            await pool.query(
                `UPDATE equipos
                 SET racha = racha + $1
                 WHERE id_equipo = $2`,
                [
                    puntos,
                    id_equipo
                ]
            );

            console.log("Racha del equipo actualizada");

        }

        res.status(200).json({
            mensaje: "Respuesta registrada correctamente",
            es_correcta,
            puntos
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al registrar la respuesta"
        });

    }

});



app.post("/codigos", async (req, res) => {

    try {

        const {
            id_usuario_creador,
            id_mundo,
            id_nivel,
            ayudas_requeridas
        } = req.body;

        let codigo;
        let existe = true;

        // Generar un código único
        while (existe) {

            codigo = generarCodigo();

            const consulta = await pool.query(
                `SELECT id_codigo
                 FROM codigos_ayuda
                 WHERE codigo = $1`,
                [codigo]
            );

            existe = consulta.rows.length > 0;
        }

        // Guardar el código
        const resultado = await pool.query(
            `INSERT INTO codigos_ayuda
            (
                codigo,
                id_usuario_creador,
                id_mundo,
                id_nivel,
                ayudas_requeridas
            )
            VALUES
            (
                $1,
                $2,
                $3,
                $4,
                $5
            )
            RETURNING *`,
            [
                codigo,
                id_usuario_creador,
                id_mundo,
                id_nivel,
                ayudas_requeridas
            ]
        );

        res.status(201).json({
            mensaje: "Código creado correctamente",
            codigo: resultado.rows[0].codigo,
            ayudas_requeridas: resultado.rows[0].ayudas_requeridas,
            ayudas_recibidas: resultado.rows[0].ayudas_recibidas,
            estado: resultado.rows[0].estado
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al crear el código."
        });

    }

});

/*=========================================================
        CONSULTAR CÓDIGO DE AYUDA
=========================================================*/

app.get("/codigos/:codigo", async (req, res) => {

    try {

        const { codigo } = req.params;

        const resultado = await pool.query(
            `SELECT
                codigo,
                id_usuario_creador,
                id_mundo,
                id_nivel,
                ayudas_requeridas,
                ayudas_recibidas,
                estado,
                fecha_creacion
             FROM codigos_ayuda
             WHERE codigo = $1`,
            [codigo]
        );

        if (resultado.rows.length === 0) {
            return res.status(404).json({
                error: "Código no encontrado."
            });
        }

        res.status(200).json(resultado.rows[0]);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al consultar el código."
        });

    }

});
/*=========================================================
        RESOLVER CÓDIGO DE AYUDA
=========================================================*/

/*=========================================================
        RESOLVER CÓDIGO DE AYUDA
=========================================================*/

app.post("/codigos/:codigo/resolver", async (req, res) => {

    console.log("====================================");
    console.log("🚀 ENTRÓ AL RESOLVER");
    console.log("====================================");

    const client = await pool.connect();

    try {

        await client.query("BEGIN");

        const { codigo } = req.params;
        const { id_usuario_ayudante } = req.body;

        console.log("📌 Código recibido:", codigo);
        console.log("📌 Body recibido:", req.body);

        // Buscar el código
        const codigoResultado = await client.query(
            `SELECT *
             FROM codigos_ayuda
             WHERE codigo = $1`,
            [codigo]
        );

        console.log("🔍 Resultado búsqueda código:", codigoResultado.rows);

        if (codigoResultado.rows.length === 0) {

            console.log("❌ Código no encontrado");

            await client.query("ROLLBACK");

            return res.status(404).json({
                error: "Código no encontrado."
            });

        }

        const ayuda = codigoResultado.rows[0];

        console.log("✅ Código encontrado:", ayuda);

        // No puede ayudarse a sí mismo
        if (ayuda.id_usuario_creador == id_usuario_ayudante) {

            console.log("❌ El usuario intentó ayudarse a sí mismo");

            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "No puedes ayudarte a ti mismo."
            });

        }

        // Verificar si ya está completado
        if (ayuda.estado === "COMPLETADO") {

            console.log("❌ Código ya completado");

            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Este código ya fue completado."
            });

        }

        // Verificar si ya ayudó anteriormente
        const ayudaExistente = await client.query(
            `SELECT id_ayuda
             FROM ayudas_realizadas
             WHERE id_codigo = $1
             AND id_usuario_ayudante = $2`,
            [
                ayuda.id_codigo,
                id_usuario_ayudante
            ]
        );

        console.log("🔍 Ayuda existente:", ayudaExistente.rows);

        if (ayudaExistente.rows.length > 0) {

            console.log("❌ El usuario ya había ayudado antes");

            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Ya ayudaste a este jugador."
            });

        }

// Obtener el equipo del ayudante
const perfilAyudante = await client.query(
    `SELECT id_equipo
     FROM perfiles
     WHERE id_usuario = $1`,
    [id_usuario_ayudante]
);

if (perfilAyudante.rows.length === 0) {

    console.log("❌ Perfil del ayudante no encontrado");

    await client.query("ROLLBACK");

    return res.status(404).json({
        error: "No se encontró el perfil del ayudante."
    });

}

const id_equipo = parseInt(perfilAyudante.rows[0].id_equipo);

console.log("👥 Equipo del ayudante:", id_equipo);
// =====================================
// OBTENER EL EQUIPO DEL CREADOR
// =====================================

const perfilCreador = await client.query(
    `SELECT id_equipo
     FROM perfiles
     WHERE id_usuario = $1`,
    [ayuda.id_usuario_creador]
);

if (perfilCreador.rows.length === 0) {

    await client.query("ROLLBACK");

    return res.status(404).json({
        error: "No se encontró el perfil del creador."
    });

}

const id_equipo_creador = parseInt(perfilCreador.rows[0].id_equipo);

console.log("👤 Equipo del creador:", id_equipo_creador);

// =====================================
// EQUIPOS QUE YA AYUDARON
// =====================================

const equiposAyudantes = await client.query(
    `SELECT id_equipo
     FROM ayudas_realizadas
     WHERE id_codigo = $1`,
    [ayuda.id_codigo]
);

const equiposRegistrados =
    equiposAyudantes.rows.map(r => parseInt(r.id_equipo));
console.log(typeof id_equipo);
console.log(typeof id_equipo_creador);
console.log(typeof equiposRegistrados[0]);
console.log("📋 Equipos registrados:", equiposRegistrados);
// =====================================
// VALIDACIONES POR CASO
// =====================================

// ¿El ayudante pertenece al mismo equipo del creador?
const esMismoEquipo = id_equipo === id_equipo_creador;

// ¿Ya ayudó alguien del equipo del creador?
const yaAyudoEquipoCreador =
    equiposRegistrados.includes(id_equipo_creador);

// ¿Ya ayudó alguien del mismo equipo del ayudante?
const yaAyudoMiEquipo =
    equiposRegistrados.includes(id_equipo);

// ==============================
// CASO 2
// ==============================
if (ayuda.ayudas_requeridas === 1) {

    if (!esMismoEquipo) {

        await client.query("ROLLBACK");

        return res.status(400).json({
            error: "En este nivel solo puede ayudarte un integrante de tu mismo equipo."
        });

    }

}

// ==============================
// CASO 3 Y CASO 4
// ==============================
else {

    // Primera ayuda
    if (equiposRegistrados.length === 0) {

        if (!esMismoEquipo) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "La primera ayuda debe ser de un integrante de tu mismo equipo."
            });

        }

    }

    // Segunda o tercera ayuda
    else {
console.log("esMismoEquipo:", esMismoEquipo);
console.log("yaAyudoEquipoCreador:", yaAyudoEquipoCreador);
console.log("yaAyudoMiEquipo:", yaAyudoMiEquipo);
console.log("equiposRegistrados:", equiposRegistrados);
console.log("id_equipo:", id_equipo);
console.log("id_equipo_creador:", id_equipo_creador);
        // Si intenta volver a entrar un integrante
        // del equipo del creador
        if (esMismoEquipo && yaAyudoEquipoCreador) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Ya participó un integrante de tu equipo."
            });

        }

        // Si intenta repetirse cualquier otro equipo
        if (!esMismoEquipo && yaAyudoMiEquipo) {

            await client.query("ROLLBACK");

            return res.status(400).json({
                error: "Ese equipo ya participó en este nivel."
            });

        }

    }

}
console.log("➡ Insertando ayuda...");

// Registrar la ayuda
await client.query(
    `INSERT INTO ayudas_realizadas
    (
        id_codigo,
        id_usuario_ayudante,
        id_equipo
    )
    VALUES
    (
        $1,
        $2,
        $3
    )`,
    [
        ayuda.id_codigo,
        id_usuario_ayudante,
        id_equipo
    ]
);

console.log("✅ Ayuda insertada");

        console.log("➡ Actualizando ayudas_recibidas...");

        // Incrementar ayudas recibidas
        const actualizado = await client.query(
            `UPDATE codigos_ayuda
             SET ayudas_recibidas = ayudas_recibidas + 1
             WHERE id_codigo = $1
             RETURNING *`,
            [ayuda.id_codigo]
        );

        console.log("✅ Código actualizado");

        const nuevoEstado = actualizado.rows[0];

        console.log("📊 Nuevo estado:", nuevoEstado);

        // ¿Ya se completó?
        if (
            nuevoEstado.ayudas_recibidas >=
            nuevoEstado.ayudas_requeridas
        ) {

            console.log("➡ Marcando código como COMPLETADO...");

            await client.query(
                `UPDATE codigos_ayuda
                 SET estado = 'COMPLETADO'
                 WHERE id_codigo = $1`,
                [ayuda.id_codigo]
            );

            console.log("✅ Estado actualizado");

        }

        console.log("➡ Haciendo COMMIT");

        await client.query("COMMIT");

        console.log("🎉 RESOLVER TERMINADO CORRECTAMENTE");

        res.status(200).json({
            mensaje: "Ayuda registrada correctamente."
        });

    } catch (error) {

        await client.query("ROLLBACK");

        console.log("====================================");
        console.log("❌ ERROR EN RESOLVER");
        console.log("====================================");

        console.error(error);
        console.error(error.stack);

        res.status(500).json({
            error: error.message
        });

    } finally {

        client.release();

        console.log("🔒 Conexión liberada");
    }

});

app.get("/ranking", async (req, res) => {

    try {

        const ranking = await pool.query(
            `SELECT
                id_equipo,
                nombre,
                racha
             FROM equipos
             WHERE activo = true
             ORDER BY racha DESC, nombre ASC
             LIMIT 3`
        );

        const resultado = ranking.rows.map((equipo, index) => ({
            posicion: index + 1,
            id_equipo: equipo.id_equipo,
            nombre: equipo.nombre,
            puntos: equipo.racha
        }));

        res.status(200).json(resultado);

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al obtener el ranking."
        });

    }

});

app.post("/puntuaciones", async (req, res) => {

    try {

        const {
            equipo,
            puntos
        } = req.body;

        if (!equipo || puntos == null) {
            return res.status(400).json({
                error: "Faltan datos."
            });
        }

        // Verificar que exista el equipo
        const existeEquipo = await pool.query(
            `SELECT
                id_equipo,
                racha
             FROM equipos
             WHERE nombre = $1`,
            [equipo]
        );

        if (existeEquipo.rows.length === 0) {
            return res.status(404).json({
                error: "El equipo no existe."
            });
        }

        // Sumar puntos al equipo
        await pool.query(
            `UPDATE equipos
             SET racha = racha + $1
             WHERE nombre = $2`,
            [
                puntos,
                equipo
            ]
        );

        // Obtener la nueva puntuación
        const actualizado = await pool.query(
            `SELECT
                id_equipo,
                nombre,
                racha
             FROM equipos
             WHERE nombre = $1`,
            [equipo]
        );

        res.status(200).json({
            mensaje: "Puntuación actualizada correctamente.",
            equipo: actualizado.rows[0]
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al actualizar la puntuación."
        });

    }

});

/*=========================================================
        GUARDAR PROGRESO DEL USUARIO
=========================================================*/

app.post("/usuarios/:id/progreso", async (req, res) => {

    try {

        const { id } = req.params;
        const { id_nivel } = req.body;

        console.log("========== GUARDAR PROGRESO ==========");
        console.log("Usuario:", id);
        console.log("Nivel:", id_nivel);

        // Buscar el perfil mediante el id_usuario
        const perfil = await pool.query(
            `SELECT id_perfil
             FROM perfiles
             WHERE id_usuario = $1`,
            [id]
        );

        if (perfil.rows.length === 0) {
            return res.status(404).json({
                error: "Perfil no encontrado."
            });
        }

        const id_perfil = perfil.rows[0].id_perfil;

        // ¿Ya existe progreso para ese nivel?
        const existe = await pool.query(
            `SELECT id_progreso
             FROM progreso_usuario
             WHERE id_perfil = $1
             AND id_nivel = $2`,
            [
                id_perfil,
                id_nivel
            ]
        );

        if (existe.rows.length === 0) {

            // Crear progreso
            await pool.query(
                `INSERT INTO progreso_usuario
                (
                    id_perfil,
                    id_nivel,
                    experiencia,
                    monedas,
                    racha,
                    porcentaje,
                    completado
                )
                VALUES
                (
                    $1,
                    $2,
                    0,
                    0,
                    0,
                    0,
                    false
                )`,
                [
                    id_perfil,
                    id_nivel
                ]
            );

            console.log("✅ Progreso creado");

        } else {

            console.log("ℹ️ El progreso ya existía");

        }

        res.status(200).json({
            mensaje: "Progreso guardado correctamente."
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error al guardar el progreso."
        });

    }

});

app.get("/usuarios/:id_usuario/codigo-pendiente", async (req, res) => {

    try {

        const { id_usuario } = req.params;

        const resultado = await pool.query(
            `
            SELECT
                codigo,
                ayudas_requeridas,
                ayudas_recibidas,
                estado,
                id_mundo,
                id_nivel
            FROM codigos_ayuda
            WHERE id_usuario_creador = $1
              AND estado = 'PENDIENTE'
            ORDER BY fecha_creacion DESC
            LIMIT 1
            `,
            [id_usuario]
        );

        if (resultado.rows.length === 0) {

            return res.json({
                tiene_codigo_pendiente: false
            });

        }

        const codigo = resultado.rows[0];

        res.json({
            tiene_codigo_pendiente: true,
            codigo: codigo.codigo,
            ayudas_requeridas: codigo.ayudas_requeridas,
            ayudas_recibidas: codigo.ayudas_recibidas,
            estado: codigo.estado,
            id_mundo: codigo.id_mundo,
            id_nivel: codigo.id_nivel
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: error.message
        });

    }

});




app.listen(3000, "0.0.0.0", () => {
    console.log("Servidor iniciado en puerto 3000");
});


