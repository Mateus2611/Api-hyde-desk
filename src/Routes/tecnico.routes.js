require("dotenv").config();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const routes = express.Router();
const db = require("../../conexao");
const upload = require("../../middlewares/uploadImagens");
const login = require("../../middlewares/login");

// Cadastrar tecnico
routes.post("/cadastro", upload.single("anexo"), async (req, res) => {
  const foto = req.file.path;
  const {
    nome,
    cpf_cnpj,
    email,
    especialidade,
    telefone,
    senha,
    confirmsenha,
  } = req.body;

  // Validação
  if (!nome) {
    return res.status(422).send({ message: "O nome é obrigatório!" });
  }
  if (!cpf_cnpj) {
    return res.status(422).send({ message: "O CPF ou CNPJ é obrigatório!" });
  }
  if (!email) {
    return res.status(422).send({ message: "O email é obrigatório!" });
  }
  if (!especialidade) {
    return res.status(422).send({ message: "A especialidade é obrigatório!" });
  }
  if (!telefone) {
    return res.status(422).send({ message: "O telefone é obrigatório!" });
  }
  if (!senha) {
    return res.status(422).send({ message: "A senha é obrigatório!" });
  }
  if (senha != confirmsenha) {
    return res.status(422).send({ message: "As senhas são diferentes!" });
  }
  if (!foto) {
    return res.status(422).send({ message: "A foto é obrigatório!" });
  }

  // Matricula
  var randomized = Math.ceil(Math.random() * Math.pow(10, 6)); //Cria um n�mero aleat�rio do tamanho definido em size.
  var digito = Math.ceil(Math.log(randomized)); //Cria o d�gito verificador inicial
  while (digito > 10) {
    //Pega o digito inicial e vai refinando at� ele ficar menor que dez
    digito = Math.ceil(Math.log(digito));
  }
  var matricula = randomized + "-" + digito;

  // Conexão com o banco e busca de dados
  db.getConnection((erro, conn) => {
    if (erro) {
      console.log(erro);
      return res.status(500).send({
        message: "Houve um erro, tente novamente mais tarde...",
        erro: erro,
      });
    }
    let query = "SELECT * FROM tecnicos WHERE cpf_cnpj = ?";
    conn.query(query, [cpf_cnpj], (erro, result) => {
      if (erro) {
        return res.status(500).send({ erro: erro });
      }
      if (result.length > 0) {
        return res.status(409).send({ message: "Técnico já cadastado" });
      } else {
        // Criptografia de senha
        bcrypt.genSalt(10, (err, salt) => {
          if (err) {
            return next(err);
          }
          bcrypt.hash(senha, salt, (errorCrypt, hashSenha) => {
            if (errorCrypt) {
              return console.log(errorCrypt);
            }

            let query =
              "INSERT INTO tecnicos (nome, cpf_cnpj, email, telefone, especialidade, matricula, senha, foto, status_tecnico) VALUES (?,?,?,?,?,?,?,?, 'Ativo')";

            conn.query(
              query,
              [
                nome,
                cpf_cnpj,
                email,
                telefone,
                especialidade,
                matricula,
                hashSenha,
                foto,
              ],
              (error, result, fields) => {
                conn.release();
                if (error) {
                  console.log(error);
                  return res.status(500).send({
                    message: "Houve um erro, tente novamente mais tarde...",
                    erro: error,
                  });
                }

                return res
                  .status(201)
                  .send({
                    message: "Técnico cadastrado com sucesso!",
                    id_tecnico: result.insertId,
                  });
              }
            );
          });
        });
      }
    });
  });
});

// Login
routes.post("/login", login, (req, res) => {
  const { cpf_cnpj, senha } = req.body;

  if (!cpf_cnpj) {
    return res.status(422).send({ message: "O cpf é obrigatório!" });
  }
  if (!senha) {
    return res.status(422).send({ message: "A senha é obrigatória!" });
  }

  db.getConnection((err, conn) => {
    if (err) {
      console.log(err);
      return res.status(500).send({ erro: err });
    }
    const query = "SELECT * FROM tecnicos WHERE cpf_cnpj = ?";
    conn.query(query, [cpf_cnpj], (erro, result, fields) => {
      conn.resume();
      if (erro) {
        console.log(erro);
        return res.status(500).send({ erro: erro });
      }
      let results = JSON.parse(JSON.stringify(result));
      console.log(results);
      if (results.length < 1) {
        return res.status(401).send({ message: "Falha na autenticação!" });
      }
      console.log(senha);
      console.log(results[0].senha);
      bcrypt.compare(senha, results[0].senha, (erro, result) => {
        if (erro) {
          return res.status(401).send({ message: "Falha na autenticação!" });
        }
        console.log(result);
        if (result) {
          let token = jwt.sign(
            {
              id_tecnico: results[0].id_tecnico,
              cpf: results[0].cpf_cnpj,
            },
            process.env.JWT_KEY,
            {
              expiresIn: "1d",
            }
          );
          return res
            .status(200)
            .send({ message: "Autenticado com sucesso!", token: token });
        }
        return res.status(401).send({ message: "Cpf ou senha inválidos!" });
      });
    });
  });
});

// Chamar técnico em específico
routes.get("/:id", (req, res, next) => {
  const id_tecnico = req.params.id;
  const query = `SELECT * FROM tecnico WHERE id_tecnico = ${id_tecnico}`;

  db.getConnection((error, conn) => {
    conn.query(query, (error, result) => {
      if (error) {
        return res.status(500).send({
          error: error,
        });
      }
      return res.status(200).send({
        result: result,
      });
    });
  });
});


//Deletar técnico
routes.delete("/deletar/:id", (req, res) => {
  const { id } = req.params;
  db.getConnection((error, conn) => {
    if (error) {
      return res.status(500).send({ error: error });
    }
    const query = "SELECT * FROM tecnico WHERE id_tecnico = ?";
    conn.query(query, [id], (error, result, field) => {
      if (error) {
        return res.status(500).send({ error: error });
      }
      if (result.length != 0) {
        const query = "DELETE FROM tecnico WHERE id_tecnico = ? ";
        conn.query(query, [id], (error, result, field) => {
          conn.release();
          if (error) {
            return res
              .status(400)
              .send({ message: "Não foi possivel deletar o técnico!" });
          }
          return res.status(200).send({ message: "O usuário foi deletado com sucesso!" });
        });
      } else {
        conn.release();
        return res.status(400).send({ message: "O usuário não existe!" });
      }
    });
  });
});

module.exports = routes;
