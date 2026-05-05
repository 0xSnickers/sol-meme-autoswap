import BigNumber from 'bignumber.js';

BigNumber.config({
  DECIMAL_PLACES: 24,
  ROUNDING_MODE: BigNumber.ROUND_HALF_UP,
});

export function bn(value = 0) {
  if (value instanceof BigNumber) {
    return value;
  }

  if (value == null || value === '') {
    return new BigNumber(0);
  }

  return new BigNumber(value);
}

export function roundBn(value, digits = 2) {
  return bn(value).decimalPlaces(digits, BigNumber.ROUND_HALF_UP).toNumber();
}

export function addBn(...values) {
  return values.reduce((sum, value) => sum.plus(bn(value)), new BigNumber(0));
}

export function subBn(base, ...values) {
  return values.reduce((sum, value) => sum.minus(bn(value)), bn(base));
}

export function mulBn(left, right) {
  return bn(left).multipliedBy(bn(right));
}

export function divBn(left, right) {
  const divisor = bn(right);
  if (divisor.isZero()) {
    return new BigNumber(0);
  }
  return bn(left).dividedBy(divisor);
}

export function sumBn(values = []) {
  return values.reduce((sum, value) => sum.plus(bn(value)), new BigNumber(0));
}

