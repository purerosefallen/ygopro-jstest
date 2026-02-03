import { YGOProTest } from '../ygopro-test';

const LUA_SERIALIZER = `
local function __ygopro_test_escape_string__(value)
  return (value:gsub('[%z\\1-\\31\\\\"]', function(c)
    if c == '\\\\' then return '\\\\\\\\' end
    if c == '\"' then return '\\\\\"' end
    if c == '\\n' then return '\\\\n' end
    if c == '\\r' then return '\\\\r' end
    if c == '\\t' then return '\\\\t' end
    return string.format('\\\\u%04x', string.byte(c))
  end))
end

local function __ygopro_test_encode_undefined__()
  return '{\"t\":\"undefined\"}'
end

local function __ygopro_test_encode_value__(value, visited)
  local valueType = aux.GetValueType(value)
  if valueType == 'nil' then
    return 'null'
  end
  if valueType == 'string' then
    return '\"' .. __ygopro_test_escape_string__(value) .. '\"'
  end
  if valueType == 'number' then
    if value ~= value or value == math.huge or value == -math.huge then
      return 'null'
    end
    return tostring(value)
  end
  if valueType == 'boolean' then
    return value and 'true' or 'false'
  end
  if valueType == 'table' then
    if visited[value] then
      return __ygopro_test_encode_undefined__()
    end
    visited[value] = true
    local isArray = true
    for key, _ in pairs(value) do
      if type(key) ~= 'number' then
        isArray = false
        break
      end
    end
    if isArray then
      local keys = {}
      for key, _ in pairs(value) do
        keys[#keys + 1] = key
      end
      table.sort(keys)
      local items = {}
      for i = 1, #keys do
        local v = value[keys[i]]
        items[#items + 1] = __ygopro_test_encode_value__(v, visited)
      end
      visited[value] = nil
      return '{\"t\":\"array\",\"v\":[' .. table.concat(items, ',') .. ']}'
    end
    local fields = {}
    for key, v in pairs(value) do
      local keyString = tostring(key)
      fields[#fields + 1] =
        '\"' .. __ygopro_test_escape_string__(keyString) .. '\":' ..
        __ygopro_test_encode_value__(v, visited)
    end
    visited[value] = nil
    return '{\"t\":\"object\",\"v\":{' .. table.concat(fields, ',') .. '}}'
  end
  if valueType == 'Card' then
    local controller = value:GetControler()
    local location = value:GetLocation()
    local sequence = value:GetSequence()
    return '{\"t\":\"card\",\"c\":' .. tostring(controller) .. ',\"l\":' .. tostring(location) .. ',\"s\":' .. tostring(sequence) .. '}'
  end
  if valueType == 'Group' then
    local items = {}
    for tc in aux.Next(value) do
      items[#items + 1] = __ygopro_test_encode_value__(tc, visited)
    end
    return '{\"t\":\"group\",\"v\":[' .. table.concat(items, ',') .. ']}'
  end
  return __ygopro_test_encode_undefined__()
end
`;

export const createEvaluateScript = (script: string, token: string) => `
${LUA_SERIALIZER}
local function __ygopro_test_run__()
${script}
end

local __ygopro_test_result__ = __ygopro_test_run__()
local __ygopro_test_encoded__ = __ygopro_test_encode_value__(__ygopro_test_result__, {})
local __ygopro_test_token__ = "${token}"
Duel.SetRegistryValue(__ygopro_test_token__, __ygopro_test_encoded__)
`;

type EncodedValuePlain = null | string | number | boolean;

type EncodedValueT =
  | { t: 'undefined' }
  | { t: 'card'; c: number; l: number; s: number }
  | { t: 'group'; v: EncodedValue[] }
  | { t: 'array'; v: EncodedValue[] }
  | { t: 'object'; v: Record<string, EncodedValue> };

type EncodedValue = EncodedValuePlain | EncodedValueT;

const decodeValue = (
  tester: YGOProTest,
  value: EncodedValue | unknown,
): any => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => decodeValue(tester, item));
  }
  if (typeof value !== 'object') return undefined;
  const typedValue = value as EncodedValueT;
  if (!('t' in typedValue)) {
    return undefined;
  }
  switch (typedValue.t) {
    case 'undefined':
      return undefined;
    case 'card':
      return tester.getCard(
        {
          controller: typedValue.c,
          location: typedValue.l,
          sequence: typedValue.s,
        },
        true,
      );
    case 'group':
      return typedValue.v.map((item) => decodeValue(tester, item));
    case 'array':
      return typedValue.v.map((item) => decodeValue(tester, item));
    case 'object': {
      const res: Record<string, any> = {};
      for (const [key, val] of Object.entries(typedValue.v)) {
        res[key] = decodeValue(tester, val);
      }
      return res;
    }
    default:
      return undefined;
  }
};

export const decodeEvaluateResult = (tester: YGOProTest, result: string) => {
  const parsed = JSON.parse(result) as EncodedValue;
  return decodeValue(tester, parsed);
};
