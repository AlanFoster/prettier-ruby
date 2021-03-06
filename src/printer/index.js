"use strict";

const util = require("../_util-from-prettier");
const tokens = require("./tokens");
const keywords = require("./keywords");

const docBuilders = require("prettier").doc.builders;
const concat = docBuilders.concat;
const join = docBuilders.join;
const hardline = docBuilders.hardline;
const line = docBuilders.line;
const softline = docBuilders.softline;
const group = docBuilders.group;
const indent = docBuilders.indent;
const dedent = docBuilders.dedent;
// const ifBreak = docBuilders.ifBreak;

function printRubyString(raw, options) {
  // `rawContent` is the string exactly like it appeared in the input source
  // code, without its enclosing quotes.
  const modifierResult = /^\w+/.exec(raw);
  const modifier = modifierResult ? modifierResult[0] : "";

  let rawContent = raw.slice(modifier.length);

  rawContent = rawContent.slice(1, -1);

  const double = { quote: '"', regex: /"/g };
  const single = { quote: "'", regex: /'/g };

  const preferred = options.singleQuote ? single : double;
  const alternate = preferred === single ? double : single;

  let shouldUseAlternateQuote = false;

  // If `rawContent` contains at least one of the quote preferred for enclosing
  // the string, we might want to enclose with the alternate quote instead, to
  // minimize the number of escaped quotes.
  // Also check for the alternate quote, to determine if we're allowed to swap
  // the quotes on a DirectiveLiteral.
  if (
    rawContent.includes(preferred.quote) ||
    rawContent.includes(alternate.quote)
  ) {
    const numPreferredQuotes = (rawContent.match(preferred.regex) || []).length;
    const numAlternateQuotes = (rawContent.match(alternate.regex) || []).length;

    shouldUseAlternateQuote = numPreferredQuotes > numAlternateQuotes;
  }

  const enclosingQuote = shouldUseAlternateQuote
    ? alternate.quote
    : preferred.quote;

  // It might sound unnecessary to use `makeString` even if the string already
  // is enclosed with `enclosingQuote`, but it isn't. The string could contain
  // unnecessary escapes (such as in `"\'"`). Always using `makeString` makes
  // sure that we consistently output the minimum amount of escaped quotes.
  return modifier + util.makeString(rawContent, enclosingQuote);
}

function printBody(path, print) {
  return join(concat([hardline]), path.map(print, "body"));
}

function printConditionalBlock(node, path, print, conditional, isSingleLine) {
  const parts = [];
  const hasElse = !!node.else_body;
  const hasThenBody = !!node.then_body;
  const thenBodyIsSingleLine = hasThenBody && node.then_body.length === 1;
  const trySingleLine = !hasElse && thenBodyIsSingleLine;
  const thenBody = isSingleLine
    ? path.call(print, "then_body")
    : join(hardline, path.map(print, "then_body"));
  if (isSingleLine || trySingleLine) {
    parts.push(
      group(concat([thenBody, " ", conditional, " ", path.call(print, "cond")]))
    );
  } else {
    parts.push(
      group(concat([conditional, " ", group(path.call(print, "cond"))]))
    );
    if (hasThenBody) {
      parts.push(indent(concat([hardline, group(thenBody)])));
    }
    if (hasElse) {
      parts.push(
        dedent(concat([hardline, group(path.call(print, "else_body"))]))
      );
    }
    parts.push(hardline);
    parts.push("end");
  }
  return parts;
}

function genericPrint(path, options, print) {
  const n = path.getValue();
  if (!n) {
    return "";
  }

  if (typeof n === "string") {
    return n;
  }

  if (typeof n === "number") {
    return n;
  }

  if (tokens.hasOwnProperty(n.ast_type)) {
    return tokens[n.ast_type];
  }

  switch (n.ast_type) {
    case "class": {
      const name = path.call(print, "name");
      const superClass = path.call(print, "superclass");
      let parts = [];
      parts.push("class ");
      parts.push(name);
      if (superClass) {
        parts.push(concat([" < ", superClass]));
      }
      parts = [group(concat(parts))];
      const body = path.call(print, "body");
      parts.push(
        indent(concat([hardline, body])),
        dedent(concat([hardline, "end"]))
      );
      return concat(parts);
    }

    case "@ident": {
      return n.value;
    }

    case "var_field": {
      return path.call(print, "body");
    }

    case "var_ref": {
      return path.call(print, "ref");
    }

    case "@int": {
      return n.value.toString();
    }

    case "symbol_literal": {
      return path.call(print, "body");
    }

    case "@const": {
      return path.call(print, "value");
    }

    case "dot3":
    case "dot2": {
      const inclusive = n.ast_type === "dot3";
      const parts = [];
      parts.push(path.call(print, "left"));
      if (inclusive) {
        parts.push("...");
      } else {
        parts.push("..");
      }
      parts.push(path.call(print, "right"));
      return concat(parts);
    }

    case "program": {
      return concat([printBody(path, print), hardline]);
    }
    case "defs":
    case "def": {
      const def = [];
      const hasReceiver = n.receiver;
      let name = path.call(print, "name");
      if (hasReceiver) {
        name = concat([path.call(print, "receiver"), ".", name]);
      }
      def.push("def ", name);

      const parts = [];

      parts.push(group(concat(def)));
      const params = path.call(print, "params");
      const paramsBody = [];
      if (params.contents.parts.length > 0) {
        paramsBody.push("(", indent(params), softline, ")");
      }
      parts.push(group(concat(paramsBody)));
      parts.push(
        indent(concat([hardline, path.call(print, "bodystmt")])),
        hardline,
        group("end")
      );

      return concat(parts);
    }

    case "params": {
      const params = [];
      const preRestParams =
        n.pre_rest_params &&
        join(concat([",", line]), path.map(print, "pre_rest_params"));

      const argsWithDefault =
        n.args_with_default &&
        join(concat([",", line]), path.map(print, "args_with_default"));

      const restParam =
        n.rest_param && concat(["*", path.call(print, "rest_param")]);

      const postRestParams =
        n.post_rest_params &&
        join(concat([",", line]), path.map(print, "post_rest_params"));

      const labelParams =
        n.label_params &&
        join(concat([",", line]), path.map(print, "label_params"));

      const doubleStarParam =
        n.double_star_param && path.call(print, "double_star_param");

      const blockarg = n.blockarg && path.call(print, "blockarg");

      if (preRestParams) {
        params.push(preRestParams);
      }
      if (argsWithDefault) {
        params.push(argsWithDefault);
      }
      if (restParam) {
        params.push(restParam);
      }
      if (postRestParams) {
        params.push(postRestParams);
      }
      if (labelParams) {
        params.push(labelParams);
      }
      if (doubleStarParam) {
        params.push(doubleStarParam);
      }
      if (blockarg) {
        params.push(blockarg);
      }
      return group(join(concat([", ", softline]), params));
    }

    case "args_with_default": {
      return group(
        concat([path.call(print, "arg"), " = ", path.call(print, "default")])
      );
    }

    case "label_param": {
      return group(
        concat([path.call(print, "label"), " ", path.call(print, "default")])
      );
    }

    case "bare_assoc_hash": {
      return join(concat([",", line]), path.map(print, "hashes"));
    }

    case "const_path_ref": {
      return join("::", path.map(print, "parts"));
    }

    case "aref": {
      return group(
        concat([path.call(print, "name"), "[", path.call(print, "args"), "]"])
      );
    }

    case "bodystmt": {
      const bodyStatementParts = [];
      const body = n.body && join(hardline, path.map(print, "body"));
      const rescueBody =
        n.rescue_body && join(hardline, path.map(print, "rescue_body"));
      const elseBody =
        n.else_body && join(hardline, path.map(print, "else_body"));
      const ensureBody =
        n.ensure_body && join(hardline, path.map(print, "ensure_body"));

      if (body) {
        bodyStatementParts.push(body);
      }
      if (rescueBody) {
        bodyStatementParts.push(rescueBody);
      }
      if (ensureBody) {
        bodyStatementParts.push(ensureBody);
      }
      if (elseBody) {
        bodyStatementParts.push(elseBody);
      }
      return concat(bodyStatementParts);
    }

    case "command": {
      const body = path.call(print, "args");
      let finalBody = group(concat(["(", body, ")"]));
      const name = n.name && path.call(print, "name");
      if (keywords.hasOwnProperty(name)) {
        finalBody = group(concat([line, body]));
      }
      const parts = [];
      parts.push(name);
      parts.push(finalBody);
      return concat(parts);
    }

    case "call": {
      const parts = [];
      parts.push(path.call(print, "obj"));
      parts.push(".");
      parts.push(path.call(print, "name"));
      return concat(parts);
    }

    case "args_add_block": {
      return group(join(concat([",", line]), path.map(print, "args_body")));
    }

    case "@label": {
      return path.call(print, "value");
    }

    case "symbol": {
      return concat([":", path.call(print, "symbol")]);
    }

    case "field": {
      const parts = [];
      parts.push(path.call(print, "receiver"));
      parts.push(".");
      parts.push(path.call(print, "name"));
      return group(concat(parts));
    }

    case "aref_field": {
      const parts = [];
      parts.push(path.call(print, "name"));
      parts.push(group(concat(["[", path.call(print, "args"), "]"])));
      return group(concat(parts));
    }

    case "const_ref": {
      return path.call(print, "value");
    }

    case "void_stmt": {
      return "";
    }
    case "assoc_new": {
      const parts = [];
      parts.push(path.call(print, "key"));
      parts.push(" ");
      if (n.has_arrow) {
        parts.push("=>");
        parts.push(" ");
      }
      if (n.value.ast_type === "hash") {
        parts.push(group(path.call(print, "value")));
      } else {
        parts.push(indent(group(path.call(print, "value"))));
      }
      return concat(parts);
    }

    case "@kw": {
      return path.call(print, "value");
    }
    case "@ivar": {
      return path.call(print, "value");
    }

    case "assign": {
      const targetParts = [];
      targetParts.push(path.call(print, "target"), line, "=");
      let value = group(path.call(print, "value"));
      if (n.value.ast_type !== "hash") {
        value = indent(group(concat([line, value])));
      } else {
        targetParts.push(line);
      }
      const target = group(concat(targetParts));
      return concat([target, value]);
    }

    case "massign": {
      const leftParts = [];
      leftParts.push(
        group(
          concat([join(concat([",", line]), path.map(print, "lefts")), " ="])
        )
      );
      let right = group(path.call(print, "right"));
      if (n.right.ast_type !== "hash") {
        right = indent(group(concat([line, right])));
      } else {
        leftParts.push(line);
      }
      const target = group(concat(leftParts));
      return concat([target, right]);
    }

    case "yield": {
      const parts = [];
      parts.push("yield");
      const hasExp = !!n.exp;
      if (hasExp) {
        parts.push(" ");
        parts.push(path.call(print, "exp"));
      }
      return group(concat(parts));
    }

    case "paren": {
      const parts = [];
      const hasExp = !!n.exps;
      if (hasExp) {
        parts.push(path.call(print, "exps"));
      }
      return group(concat(parts));
    }

    case "unary": {
      const parts = [];
      let operator = path.call(print, "operator");
      if (operator === "-@") {
        operator = "-";
      }
      parts.push(operator);
      parts.push(path.call(print, "exp"));
      return concat(parts);
    }

    case "binary": {
      const parts = [];
      parts.push(path.call(print, "left"));
      parts.push(line);
      parts.push(path.call(print, "operator"));
      parts.push(line);
      parts.push(path.call(print, "right"));
      return group(concat(parts));
    }

    case "lambda": {
      const parts = [];
      parts.push("->");
      const params = path.call(print, "params");
      if (params.contents.parts.length > 0) {
        parts.push(concat(["(", params, ")"]));
      }
      parts.push(concat([line, "{", line]));
      parts.push(join(";", path.map(print, "body")));
      parts.push(concat([line, "}"]));
      return group(concat(parts));
    }

    case "vcall": {
      return path.call(print, "value");
    }

    case "method_add_arg": {
      return concat([
        path.call(print, "name"),
        "(",
        path.call(print, "args"),
        ")"
      ]);
    }

    case "fcall": {
      return path.call(print, "name");
    }

    case "arg_paren": {
      return path.call(print, "args");
    }
    case "string_literal": {
      return concat(path.map(print, "string_content"));
    }

    case "@tstring_content": {
      return printRubyString('"' + path.call(print, "content") + '"', options);
    }

    case "return": {
      const value = path.call(print, "value");
      return group(concat(["return", value ? " " : "", value]));
    }

    case "method_add_block": {
      const parts = [];
      parts.push(path.call(print, "call"));
      parts.push(path.call(print, "block"));
      return concat(parts);
    }

    case "case": {
      const parts = [];
      parts.push("case ", path.call(print, "cond"));
      parts.push(concat([hardline, path.call(print, "case_when")]));
      parts.push(concat([hardline, "end"]));
      return concat(parts);
    }

    case "when": {
      const parts = [];
      parts.push("when ", join(", ", path.map(print, "conds")));
      parts.push(
        indent(concat([hardline, join(hardline, path.map(print, "body"))]))
      );
      parts.push(concat([hardline, path.call(print, "next_exp")]));
      return concat(parts);
    }

    case "while_mod": {
      const parts = printConditionalBlock(n, path, print, "while", true);
      return concat(parts);
    }

    case "while": {
      const parts = printConditionalBlock(n, path, print, "while");
      return concat(parts);
    }

    case "until": {
      const parts = printConditionalBlock(n, path, print, "until");
      return concat(parts);
    }

    case "until_mod": {
      const parts = printConditionalBlock(n, path, print, "until", true);
      return concat(parts);
    }

    case "if": {
      const parts = printConditionalBlock(n, path, print, "if");
      return concat(parts);
    }

    case "if_mod": {
      const parts = printConditionalBlock(n, path, print, "if", true);
      return concat(parts);
    }

    case "elsif": {
      const parts = [];
      parts.push(group(concat(["elsif ", group(path.call(print, "cond"))])));
      parts.push(
        indent(concat([hardline, group(concat(path.map(print, "then_body")))]))
      );
      if (n.else_body) {
        parts.push(
          dedent(concat([hardline, group(path.call(print, "else_body"))]))
        );
      }
      return concat(parts);
    }

    case "else": {
      const parts = [];
      parts.push("else");
      if (n.else_body) {
        parts.push(
          indent(
            concat([hardline, group(concat(path.map(print, "else_body")))])
          )
        );
      }
      return concat(parts);
    }

    case "brace_block": {
      const parts = [];
      parts.push(
        " { ",
        "|",
        path.call(print, "args"),
        "| ",
        join("; ", path.map(print, "body")),
        " }"
      );
      return group(concat(parts));
    }

    case "do_block": {
      const parts = [];
      parts.push(group(concat([" do ", "|", path.call(print, "args"), "|"])));
      parts.push(
        indent(concat([hardline, join(hardline, path.map(print, "body"))]))
      );
      parts.push(hardline);
      parts.push(dedent("end"));
      return concat(parts);
    }

    case "block_var": {
      return group(join(concat([",", line]), path.map(print, "args")));
    }

    case "array": {
      return group(
        concat([
          "[",
          join(concat([", ", softline]), path.map(print, "body")),
          "]"
        ])
      );
    }

    case "hash": {
      const body = path.map(print, "elements");
      const hasBody = body.length > 0;
      const bodyParts = [];
      if (hasBody) {
        bodyParts.push(indent(concat([line, join(concat([",", line]), body)])));
      }
      const parts = [];
      parts.push("{");
      parts.push(concat(bodyParts));
      if (hasBody) {
        parts.push(line);
      }
      parts.push(dedent(concat(["}"])));
      return group(concat(parts));
    }

    default:
      // eslint-disable-next-line no-console
      console.error("Unknown Ruby Node:", n);
      return JSON.stringify(n);
  }
}

module.exports = genericPrint;
