a = b
a ||= {}
a ||= {
  a: 10,
  b: 20
}
a ||= {
  with_long_variable_names: 10,
  with_even_longer_variable_names: 20,
  with_even_even_longer_variable_names: 20,
}
a += 1
a -= 1
a &= 1
a |= 1
a ^= 1
a %= 1
