# Script V2 — biblioteca de referência da API

> ⚠️ **Isto é documentação, não código a copiar.** As classes abaixo são uma implementação que **simula** como os objetos globais `request`, `context`, `time` e `TimeSpan` se comportam dentro do motor Script V2 (ClearScript + V8) do BLiP. Elas existem só para você entender assinaturas, tipos de retorno e comportamento de borda.
>
> - **Nunca** cole o código destas classes dentro do script gerado para o bot — o script do bot só deve conter a função `run` e a lógica de negócio, usando `request`, `context`, `time` e `TimeSpan` como se já existissem no ambiente.
> - **Nunca** modifique estas classes de referência.
> - Consulte este arquivo quando precisar confirmar um detalhe de comportamento (ex.: o que acontece com uma expiração negativa, ou como o corpo de uma requisição GET é tratado) que não está no resumo rápido do `SKILL.md`.

## Índice

1. [request](#1-request) — `request.fetchAsync(url, options?)`
2. [context](#2-context) — `context.getVariableAsync` / `setVariableAsync` / `deleteVariableAsync`
3. [time](#3-time) — `time.parseDate` / `time.dateToString` / `time.sleep`
4. [TimeSpan](#4-timespan) — `TimeSpan.fromMinutes` / `TimeSpan.fromMilliseconds`

---

## 1. request

```javascript
/**
 * Erro lançado quando um método HTTP inválido é fornecido.
 * @class InvalidMethodError
 */
class InvalidMethodError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidMethodError";
  }
}

/**
 * Utilitário para validação e gerenciamento de métodos HTTP.
 * @class HttpMethod
 */
class HttpMethod {
  static #methods = Object.freeze([
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
    "HEAD",
    "TRACE",
  ]);

  static isValid(method) {
    return this.#methods.includes(method);
  }

  static get default() {
    return "GET";
  }
}

/**
 * Representa as opções de uma requisição HTTP.
 * @class HttpRequestOptions
 */
class HttpRequestOptions {
  /**
   * @param {object} options - As opções da requisição.
   * @param {string} [options.method] - Método HTTP.
   * @param {object} [options.headers] - Cabeçalhos HTTP.
   * @param {*} [options.body] - Corpo da requisição.
   */
  constructor(options = {}) {
    this.method = options.method || HttpMethod.default;
    this.headers = options.headers || {};
    this.body = options.body || null;

    if (!HttpMethod.isValid(this.method)) {
      throw new InvalidMethodError(`'${this.method}' is not a valid method`);
    }
  }

  toFetchInit() {
    const init = {
      method: this.method,
      headers: this.headers,
    };

    if (this.#hasBody()) {
      init.body = JSON.stringify(this.body);
    }

    return init;
  }

  // Corpo só é enviado quando o método não é GET e um body foi passado.
  #hasBody() {
    return this.method !== HttpMethod.default && this.body;
  }
}

/**
 * Representa a resposta de uma requisição HTTP.
 * @class HttpResponseWrapper
 */
class HttpResponseWrapper {
  constructor(response, rawBody) {
    this.status = response.status;
    this.headers = this.#headersToObject(response.headers);
    this.body = rawBody;
    this.success = this.#isSuccessful();

    const parsedJson = this.#parseJson(rawBody);
    if (parsedJson !== undefined) {
      this.json = parsedJson;
    }
  }

  #isSuccessful() {
    return this.status >= 200 && this.status < 300;
  }

  #headersToObject(headers) {
    const obj = {};
    headers.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  #parseJson(body) {
    try {
      return JSON.parse(body);
    } catch (_) {
      return;
    }
  }

  /** @returns {Promise<object|null>} */
  async jsonAsync() {
    return this.json;
  }
}

/**
 * Classe responsável por realizar requisições HTTP.
 * @class HttpRequest
 */
export class HttpRequest {
  /**
   * @param {string} url
   * @param {object} [options]
   * @returns {Promise<HttpResponseWrapper|object>}
   */
  async fetchAsync(url, options = {}) {
    const requestOptions = new HttpRequestOptions(options);
    const init = requestOptions.toFetchInit();

    try {
      const response = await fetch(url, init);
      const rawBody = await response.text();
      return new HttpResponseWrapper(response, rawBody);
    } catch (error) {
      // Em caso de falha de rede, retorna um objeto de resposta "vazio" com success: false
      // em vez de lançar — o script deve checar `.success` após o fetchAsync.
      return {
        status: 0,
        headers: {},
        body: null,
        json: null,
        success: false,
        error: error.message,
        jsonAsync: async () => null,
      };
    }
  }
}
```

**Uso típico:**

```javascript
async function run() {
  const response = await request.fetchAsync(
    "https://jsonplaceholder.typicode.com/todos/1",
  );

  /* response example:
      {
        status: 200,
        headers: { 'key1': ['value1', 'value2'] },
        body: '{"userId": 1, "id": 1, "title": "delectus aut autem", "completed": false}',
        success: true
      }
    */

  const json = await response.jsonAsync();
  // json: { userId: 1, id: 1, title: 'delectus aut autem', completed: false }
}
```

---

## 2. context

```javascript
/**
 * Erro lançado quando um valor negativo é fornecido para a expiração.
 * @class NegativeExpirationError
 */
class NegativeExpirationError extends Error {
  constructor() {
    super("Expiration time cannot be negative. Use zero for no expiration.");
    this.name = "ExpirationError";
  }
}

/**
 * Garante que o nome de uma variável seja uma string válida.
 * @class VariableName
 */
class VariableName {
  #value;

  constructor(name) {
    if (!name) throw new ReferenceError("'name' argument is required");
    if (typeof name !== "string")
      throw new TypeError("'name' name must be a string");
    this.#value = name;
  }

  toString() {
    return this.#value;
  }
}

/**
 * Encapsula um valor de variável e sua possível expiração.
 * @class VariableEntry
 */
class VariableEntry {
  constructor(value, expiration = 0) {
    this.value = value;
    this.expiration = expiration > 0 ? Date.now() + expiration : null;
  }

  isExpired() {
    return this.expiration !== null && Date.now() > this.expiration;
  }
}

/**
 * Repositório interno para armazenamento de variáveis com controle de expiração.
 * @class VariableRepository
 */
class VariableRepository {
  #store = new Map();

  has(name) {
    const entry = this.#store.get(name);
    return entry && !entry.isExpired();
  }

  get(name) {
    const entry = this.#store.get(name);
    if (!entry || entry.isExpired()) {
      this.#store.delete(name);
      return null;
    }
    return entry.value;
  }

  set(name, value, expiration = 0) {
    const entry = new VariableEntry(value, expiration);
    this.#store.set(name, entry);
  }

  delete(name) {
    this.#store.delete(name);
  }
}

/**
 * Gerenciamento assíncrono de variáveis de contexto com suporte a expiração.
 * @class Context
 */
export class Context {
  #repository;

  constructor() {
    this.#repository = new VariableRepository();
  }

  /** @returns {Promise<*>} Valor da variável ou null se não existir ou estiver expirada. */
  async getVariableAsync(name) {
    const _name = new VariableName(name);
    return this.#repository.get(_name.toString());
  }

  /** @param {number} expiration - Tempo até expiração em ms (0 = sem expiração). */
  async setVariableAsync(name, value, expiration = 0) {
    const _name = new VariableName(name);

    if (expiration < 0) throw new NegativeExpirationError();
    if (value === undefined) {
      this.#repository.set(_name.toString(), {}, expiration);
      return;
    }

    this.#repository.set(_name.toString(), value, expiration);
  }

  async deleteVariableAsync(name) {
    const _name = new VariableName(name);
    if (!this.#repository.has(_name.toString())) return;
    this.#repository.delete(_name.toString());
  }
}
```

**Uso típico:**

```javascript
async function run() {
  await context.setVariableAsync("myVariable", "myValue");
  // Variable value: 'myValue'

  await context.setVariableAsync("myVariable", "myValue", TimeSpan.fromMinutes(5));
  // Variable value: 'myValue', expira em 5 minutos

  await context.setVariableAsync("myVariable", 100, TimeSpan.fromMilliseconds(100));
  // Variable value: '100'

  await context.setVariableAsync("myVariable", { complex: true }, TimeSpan.fromMilliseconds(100));
  // Variable value: '{"complex":true}' (objetos são serializados)

  await context.deleteVariableAsync("myVariable");
}
```

---

## 3. time

```javascript
import moment from "moment-timezone";

/**
 * @class InvalidDateError
 */
class InvalidDateError extends Error {
  constructor(message) {
    super(message);
    this.name = "InvalidDateError";
  }
}

/**
 * Utilitária para formatação de datas e tokens de formato.
 * @class TimeFormatter
 */
class TimeFormatter {
  static formatDate(date, timeZone, format) {
    return moment(date).tz(timeZone).format(format);
  }

  static defaultFormat() {
    return "YYYY-MM-DDTHH:mm:ss.SSSSSSSZ";
  }

  // Compatibiliza tokens de formato customizados (ex.: "dd") com os tokens do moment.js ("DD").
  static replaceFormatTokens(format) {
    return format.replace("dd", "DD");
  }
}

/**
 * Manipulação de datas e horários com formatação, parsing e fuso horário.
 * @class Time
 */
export class Time {
  #defaultTimeZone;

  constructor() {
    this.#defaultTimeZone = "America/Sao_Paulo";
    moment.tz.setDefault(this.#defaultTimeZone);
  }

  #createMomentDate(date, format, culture) {
    return format ? moment(date, format, culture) : moment(date);
  }

  #normalizeFormat(format) {
    return format
      ? TimeFormatter.replaceFormatTokens(format)
      : TimeFormatter.defaultFormat();
  }

  /**
   * @param {string|Date} date
   * @param {Object} [options]
   * @param {string} [options.format]
   * @param {string} [options.culture] - default "en-US"
   * @param {string} [options.timeZone] - default fuso horário do bot / America/Sao_Paulo
   * @returns {Date}
   * @throws {InvalidDateError}
   */
  parseDate(date, options = {}) {
    const format = options.format;
    const culture = options.culture || "en-US";
    const timeZone = options.timeZone || this.#defaultTimeZone;

    const parsedDate = this.#createMomentDate(date, format, culture);
    if (!parsedDate.isValid()) throw new InvalidDateError("Date is invalid");

    return parsedDate.tz(timeZone).toDate();
  }

  /**
   * @param {Date} date
   * @param {Object} [options]
   * @param {string} [options.timeZone]
   * @param {string} [options.format]
   * @returns {string}
   */
  dateToString(date, options = {}) {
    const timeZone = options.timeZone || this.#defaultTimeZone;
    const format = this.#normalizeFormat(options.format);

    const zonedDate = moment(date).tz(timeZone);
    return zonedDate.format(format);
  }

  /** @returns {Promise<void>} */
  sleep(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
}
```

**Por que usar `time.parseDate` em vez de `new Date(...)`:** o motor ClearScript + V8 não ajusta o fuso horário local do engine para o fuso horário configurado do bot. Apenas três funções do protótipo `Date` foram adaptadas para respeitar o fuso do bot (`toDateString`, `toTimeString`, `toString` — usam `builder:#localTimeZone` da configuração do fluxo quando disponível). Fora isso, `new Date(...)` usa o fuso horário do servidor, não o do bot. Por isso:

```javascript
// Evite:
const date = new Date('2021-01-01T00:00:10'); // usa o fuso horário local do servidor

// Prefira:
const date = time.parseDate('2021-01-01T00:00:10'); // usa o fuso do bot, ou America/Sao_Paulo como fallback
```

**Exemplos de `parseDate`:**

```javascript
const date = time.parseDate("2021-01-01T19:01:01.0000001+08:00");

const date = time.parseDate("01/02/2021", { format: "MM/dd/yyyy" });

const date = time.parseDate("2021-01-01 19:01:01", {
  format: "yyyy-MM-dd HH:mm:ss",
  timeZone: "America/New_York",
});

const date = time.parseDate("01/01/2021", {
  format: "dd/MM/yyyy",
  culture: "pt-BR",
});
```

---

## 4. TimeSpan

```javascript
/**
 * @class TimeSpan
 */
export class TimeSpan {
  /** @param {number} minutes @returns {number} Milissegundos equivalentes */
  static fromMinutes(minutes) {
    return minutes * 60 * 1000;
  }

  /** @param {number} milliseconds @returns {number} O mesmo valor em milissegundos */
  static fromMilliseconds(milliseconds) {
    return milliseconds;
  }
}
```

Usado sobretudo como terceiro argumento (`expiration`) de `context.setVariableAsync`.

---

## Regras do Script V2 (checklist completo)

- O script deve ser escrito em **JavaScript puro**.
- Será interpretado pela biblioteca **ClearScript** dentro do ambiente BLiP.
- Deve possuir **uma e somente uma** função chamada `run` como função principal.
- A função `run` pode ou não receber parâmetros.
- Todo argumento recebido pela função `run` será fornecido pela BLiP como tipo `string`.
- Todo valor não primitivo recebido pela função `run` como argumento deve ser parseado com `JSON.parse()`.
- Todo valor não primitivo retornado pela função `run` deve ser convertido em JSON (`JSON.stringify`) antes de retornar.
- **Nunca** utilize bibliotecas externas (ex.: pacotes npm) — apenas os objetos globais `request`, `context`, `time`, `TimeSpan` e JavaScript puro.
- O script **não deve** conter `console.log()` em nenhum lugar.
- Construa o script usando **early return / guard clauses**.
- Siga as regras de **Object Calisthenics** (evite else, mantenha métodos pequenos, encapsule primitivos quando fizer sentido, um nível de indentação por bloco, etc.).

**Interpolação de variáveis do Builder dentro do script:** use sempre template string, nunca concatenação:

```javascript
function run() {
  const email = `{{email}}`; // sempre template string para interpolação
}
```
