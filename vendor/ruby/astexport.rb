require 'ripper'
require 'json'

@json = []

def visit(node)
  case node.first
  when :program
    body = visit_exps(node[1])
    { ast_type: 'program', body: body, comments: [] }
  when :class
    visit_class(node)
  when :assign
    target, value = visit_assign(node)
    { ast_type: 'assign', target: target, value: value }
  when :var_field
    body = visit(node[1])
    { ast_type: 'var_field', body: body }
  when :@ident
    { ast_type: '@ident', value: node[1] }
  when :@int
    { ast_type: '@int', value: node[1] }
  when :@kw
    # [:@kw, "nil", [1, 0]]
    type, value = node
    { ast_type: type, value: value }
  when :@const
    # [:@const, "Constant", [1, 0]]
    type, value = node
    { ast_type: type, value: value }
  when :@ivar
    # [:@ivar, "@foo", [1, 0]]
    type, value = node
    { ast_type: type, value: value }
  when :@cvar
    # [:@cvar, "@@foo", [1, 0]]
    type, value = node
    { ast_type: type, value: value }
  when :@const
    # [:@const, "FOO", [1, 0]]
    type, value = node
    { ast_type: type, value: value }
  when :const_ref
    # [:const_ref, [:@const, "Foo", [1, 8]]]
    type, value = node
    { ast_type: type, value: visit(value) }
  when :void_stmt
    # Empty statement
    #
    # [:void_stmt]
    { ast_type: "void_stmt" }
  when :dot2
    visit_range(node)
  when :dot3
    visit_range(node)
  when :massign
    visit_multiple_assign(node)
  when :bare_assoc_hash
    # [:bare_assoc_hash, exps]
    type, exps = node
    { ast_type: type, hashes: visit_exps(exps) }
  when :aref
    visit_array_access(node)
  when :call
    visit_call(node)
  when :field
    visit_field(node)
  when :aref_field
    visit_array_field(node)
  when :array
    { ast_type: 'array', body: visit_exps(node[1]) }
  when :method_add_block
    { ast_type: 'method_add_block', call: visit(node[1]), block: visit(node[2]) }
  when :method_add_arg
    { ast_type: 'method_add_arg', name: visit(node[1]), args: visit(node[2]) }
  when :fcall
    { ast_type: 'fcall', name: visit(node[1]) }
  when :do_block
    { ast_type: 'do_block', args: visit(node[1]), body: visit_exps(node[2]) }
  when :brace_block
    visit_brace_block(node)
  when :block_var
    args, local_args = visit_block_args(node)
    { ast_type: 'block_var', args: args, local_args: local_args }
  when :var_ref
    { ast_type: 'var_ref', ref: visit(node[1]) }
  when :arg_paren
    { ast_type: 'arg_paren', args: visit(node[1]) }
  when :args_add_block
    { ast_type: 'args_add_block', args_body: visit_exps(node[1]) }
  when :vcall
    { ast_type: 'vcall', value: visit(node[1]) }
  when :defs
    visit_defs(node)
  when :def
    visit_def(node)
  when :params
    visit_params(node)
  when :rest_param
    { ast_type: 'rest_param', param: visit(node[1]) }
  when :const_path_ref
    visit_path(node)
  when :hash
    type, elements = node
    if elements
      elements = visit_exps(elements[1])
    else
      elements = []
    end
    { ast_type: type, elements: elements }
  when :@label
    # [:@label, "foo:", [1, 3]]
    { ast_type: '@label', value: node[1] }
  when :string_literal, :xstring_literal
    visit_string_literal(node)
  when :string_content
    # [:string_content, exp]
    visit_exps node[1..-1]
  when :symbol_literal
    visit_symbol_literal(node)
  when :symbol
    visit_symbol(node)
  when :dyna_symbol
    visit_quoted_symbol_literal(node)
  when :bodystmt
    visit_bodystmt(node)
  when :ifop
    visit_ternary_if(node)
  when :if_mod
    visit_if_mod(node)
  when :until_mod
    visit_until_mod(node)
  when :while
    visit_while(node)
  when :while_mod
    visit_while_mod(node)
  when :command
    visit_command(node)
  when :assoc_new
    visit_hash_key_value(node)
  when :until
    visit_until(node)
  when :if
    visit_if(node)
  when :elsif
    visit_if(node)
  when :return
    visit_return(node)
  when :@tstring_content
    type, content = node
    { ast_type: type, content: content }
  when :else
    type, else_body = node
    { ast_type: type, else_body: visit_exps(else_body) }
  when :binary
    visit_binary(node)
  when :unary
    visit_unary(node)
  when :yield
    visit_yield(node)
  when :paren
    visit_paren(node)
  when :lambda
    visit_lambda(node)
  when :case
    visit_case(node)
  when :when
    visit_when(node)
  else
    { ast_type: node.first, error: "Unhandled node: #{node.first}" }
  end
end

def visit_lambda(node)
  # [:lambda, [:params, nil, nil, nil, nil, nil, nil, nil], [[:void_stmt]]]
  type, params, body = node
  { ast_type: type, params: visit(params), body: visit_exps(body) }
end

def visit_paren(node)
  # ( exps )
  # [:paren, exps]
  type, exps = node
  { ast_type: type, exps: visit(exps) }
end

def visit_yield(node)
  # [:yield, exp]
  type, exp = node
  { ast_type: type, exp: visit(exp) }
end

def visit_multiple_assign(node)
  # [:massign, lefts, right]
  type, lefts, right = node
  { ast_type: type, lefts: visit_exps(lefts), right: visit(right) }
end

def visit_brace_block(node)
  # [:brace_block, args, body]
  type, args, body = node
  { ast_type: type, args: visit(args), body: visit_exps(body) }
end

def visit_range(node)
  # [:dot2, left, right]
  # [:dot3, left, right]
  type, left, right = node
  { ast_type: type, left: visit(left), right: visit(right) }
end

def visit_array_access(node)
  # exp[arg1, ..., argN]
  #
  # [:aref, name, args]
  type, name, args = node
  { ast_type: type, name: visit(name), args: visit(args) }
end

def visit_path(node)
  # Foo::Bar
  #
  # [:const_path_ref,
  #   [:var_ref, [:@const, "Foo", [1, 0]]],
  #   [:@const, "Bar", [1, 5]]]
  parts = node[1..-1]
  { ast_type: "const_path_ref", parts: visit_exps(parts) }
end

def visit_call(node)
  # Unparser.unparse(node)
  # [:call, obj, :".", name]
  type, obj, _, name = node
  { ast_type: type, obj: visit(obj), name: visit(name) }
end

def visit_array_field(node)
  # foo[arg1, arg2, ..]
  # [:aref_field, name, args]
  type, name, args = node
  { ast_type: type, name: visit(name), args: visit(args) }
end

def visit_field(node)
  # foo.bar
  # [:field, receiver, :".", name]
  type, receiver, _, name = node
  { ast_type: type, receiver: visit(receiver), name: visit(name) }
end

def visit_defs(node)
  # [:defs,
  # [:vcall, [:@ident, "foo", [1, 5]]],
  # [:@period, ".", [1, 8]],
  # [:@ident, "bar", [1, 9]],
  # [:params, nil, nil, nil, nil, nil, nil, nil],
  # [:bodystmt, [[:void_stmt]], nil, nil, nil]]
  type, receiver, period, name, params, body = node
  if params[0] == :paren
    params = visit(params[1])
  else
    params = visit(params)
  end
  { ast_type: type, receiver: visit(receiver), name: visit(name), params: params, bodystmt: visit(body) }
end

def visit_def(node)
  type, name, params, body = node
  if params[0] == :paren
    params = visit(params[1])
  else
    params = visit(params)
  end
  { ast_type: type, name: visit(name), params: params, bodystmt: visit(body) }
end

def visit_return(node)
  # [:return, exp]
  type, exp = node
  { ast_type: type, value: exp ? visit(exp) : nil }
end

def visit_hash_key_value(node)
  # key => value
  # [:assoc_new, key, value]
  type, key, value = node

  symbol = key[0] == :symbol_literal
  arrow = symbol || !(key[0] == :@label || key[0] == :dyna_symbol)
  if arrow
    key = visit key[1]
  else
    key = visit key
  end
  value = visit value
  { ast_type: type, key: key, value: value, has_arrow: arrow }
end

def visit_command(node)
  # puts arg1, ..., argN
  #
  # [:command, name, args]
  type, name, args = node

  name = visit(name)
  args = visit(args)
  { ast_type: type, name: name, args: args }
end

def visit_bodystmt(node)
  # [:bodystmt, body, rescue_body, else_body, ensure_body]
  type, body, rescue_body, else_body, ensure_body = node

  body = visit_exps(body) if body
  rescue_body = visit(rescue_body) if rescue_body
  else_body = visit(else_body) if else_body
  ensure_body = visit(ensure_body) if ensure_body
  { ast_type: type, body: body, rescue_body: rescue_body, else_body: else_body, ensure_body: ensure_body }
end

def visit_exps(node)
  exprs = []
  node.each do |exp|
    type, _ = exp
    exprs << visit(exp) unless type == :void_stmt
  end
  exprs
end

def visit_assign(node)
  _, target, value = node
  target = visit(target)
  value = visit(value)
  [target, value]
end

def isEmpty?(args)
  a, b, c, d, e, f, g, h = args
  !a && !b && !c && !d && !e && !f && !g && !h
end

def visit_block_args(node)
  _, node_params, node_local_params = node
  params = []
  unless isEmpty?(node_params)
    params = visit_exps(node_params[1])
  end
  local_params = visit(node_local_params[1]) unless isEmpty?(node_local_params)
  [params, local_params]
end

def visit_params(node)
  # (def params)
  #
  # [:params, pre_rest_params, args_with_default, rest_param, post_rest_params, label_params, double_star_param, blockarg]
  type,
  pre_rest_params,
  args_with_default,
  rest_param,
  post_rest_params,
  label_params,
  double_star_param,
  blockarg = node

  pre_rest_params = visit_exps(pre_rest_params) if pre_rest_params
  args_with_default = visit_args_with_default(args_with_default) if args_with_default
  rest_param = visit(rest_param[1]) if rest_param
  post_rest_params = visit_exps(post_rest_params) if post_rest_params
  label_params = visit_label_params(label_params) if label_params
  double_star_param = visit(double_star_param) if double_star_param
  blockarg = visit(blockarg) if blockarg
  {
    ast_type: type,
    pre_rest_params: pre_rest_params,
    args_with_default: args_with_default,
    rest_param: rest_param,
    post_rest_params: post_rest_params,
    label_params: label_params,
    double_star_param: double_star_param,
    blockarg: blockarg
  }
end

def visit_label_params(nodes)
  # [[[ :@label, name ], [key, value]]]
  params = []
  nodes.each do |node|
    label, default = node
    label = visit(label)
    default = visit(default)
    params << { ast_type: "label_param", label: label, default: default }
  end
  params
end

def visit_args_with_default(nodes)
  args = []
  nodes.each do |node|
    arg, default = node
    arg = visit(arg)
    default = visit(default)
    args << { ast_type: "args_with_default", arg: arg, default: default }
  end
  args
end


def visit_symbol_literal(node)
  # :foo
  #
  # [:symbol_literal, [:symbol, [:@ident, "foo", [1, 1]]]]
  #
  # A symbol literal not necessarily begins with `:`.
  # For example, an `alias foo bar` will treat `foo`
  # a as symbol_literal but without a `:symbol` child.
  { ast_type: node[0], body: visit(node[1]) }
end

def visit_symbol(node)
  # :foo
  #
  # [:symbol, [:@ident, "foo", [1, 1]]]
  { ast_type: node[0], symbol: visit(node[1]) }
end

def visit_quoted_symbol_literal(node)
  # :"foo"
  #
  # [:dyna_symbol, exps]
  _, exps = node

  # This is `"...":` as a hash key
  # if current_token_kind == :on_tstring_beg
  #   consume_token :on_tstring_beg
  #   visit exps
  #   consume_token :on_label_end
  # else
  #   consume_token :on_symbeg
  #   visit_exps exps, with_lines: false
  #   consume_token :on_tstring_end
  # end
  visit exps
end

def visit_if_mod(node)
  # then if cond
  #
  # [:if_mod, cond, body]
  type, cond, body = node

  { ast_type: type, then_body: visit(body), cond: visit(cond) }
end

def visit_while_mod(node)
  # then while cond
  #
  # [:while_mod, cond, body]
  type, cond, body = node

  { ast_type: type, then_body: visit(body), cond: visit(cond) }
end

def visit_until_mod(node)
  # then unless cond
  #
  # [:until_mod, cond, body]
  type, cond, body = node

  { ast_type: type, then_body: visit(body), cond: visit(cond) }
end

def visit_ternary_if(node)
  # cond ? then : else
  #
  # [:ifop, cond, then_body, else_body]
  type, cond, then_body, else_body = node

  { ast_type: type, cond: visit(cond), then_body: visit(then_body), else_body: visit(else_body)}
end

def visit_if(node)
  # if cond
  #   then_body
  # else
  #   else_body
  # end
  #
  # [:if, cond, then, else]
  type, cond, then_body, else_body = node

  {
    ast_type: type,
    cond: visit(cond),
    then_body: then_body ? visit_exps(then_body) : nil,
    else_body: else_body ? visit(else_body) : nil
  }
end

def visit_until(node)
  # until cond
  #   then_body
  # else
  #   else_body
  # end
  #
  # [:until, cond, then, else]
  type, cond, then_body, else_body = node

  {
    ast_type: type,
    cond: visit(cond),
    then_body: then_body ? visit_exps(then_body) : nil,
    else_body: else_body ? visit(else_body) : nil
  }
end

def visit_while(node)
  # while cond
  #   then_body
  # end
  #
  # [:while, cond, then]
  type, cond, then_body = node

  {
    ast_type: type,
    cond: visit(cond),
    then_body: then_body ? visit_exps(then_body) : nil,
  }
end

def visit_string_literal(node)
  # [:string_literal, [:string_content, exps]]
  type, string_content = node
  { ast_type: type, string_content: visit(string_content) }
end

def visit_unary(node)
  # [:unary, op, exp]
  type, op, exp = node
  { ast_type: type, operator: op, exp: visit(exp) }
end

def visit_binary(node)
  # [:binary, left, op, right]
  type, left, op, right = node
  { ast_type: type, left: visit(left), operator: op, right: visit(right) }
end

def visit_class(node)
  # [:class, name, superclass, [:bodystmt, body, nil, nil, nil] ]
  type, name, superclass, body = node

  {
    ast_type: type,
    name: visit(name),
    superclass: superclass ? visit(superclass) : nil,
    body: body ? visit(body) : nil
  }
end

def visit_case(node)
  # [:case, cond, case_when]
  type, cond, case_when = node

  cond = cond ? visit(cond) : nil;

  case_when = visit case_when
  { ast_type: type, cond: cond, case_when: case_when }
end

def visit_when(node)
  # [:when, conds, body, next_exp]
  type, conds, body, next_exp = node
  { ast_type: type, conds: visit_exps(conds), body: visit_exps(body), next_exp: visit(next_exp) }
end

data = ARGV.first
sexp = Ripper.sexp(data.to_s)
@json = visit(sexp)
puts JSON.pretty_generate(@json)
