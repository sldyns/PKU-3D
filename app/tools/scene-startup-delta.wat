;; Reuse the existing fixed 512 KiB transpose arena. Each i32x4 lane restores
;; one original opaque UInt32 word modulo 2^32; no floating-point operation.
(module
  (import "env" "memory" (memory 8))
  (global $a (mut v128) (v128.const i32x4 0 0 0 0))
  (global $b (mut v128) (v128.const i32x4 0 0 0 0))
  (func (export "reset")
    (global.set $a (v128.const i32x4 0 0 0 0))
    (global.set $b (v128.const i32x4 0 0 0 0)))
  (func (export "undo") (param $p i32) (param $n i32)
    (local $i i32) (local $v v128)
    (block $done
      (loop $rows
        (br_if $done (i32.ge_u (local.get $i) (local.get $n)))
        (local.set $v (v128.load (local.get $p)))
        (local.set $v
          (i32x4.add (global.get $a)
            (v128.xor
              (i32x4.shr_u (local.get $v) (i32.const 1))
              (i32x4.neg
                (v128.and (local.get $v) (v128.const i32x4 1 1 1 1))))))
        (v128.store (local.get $p) (local.get $v))
        (global.set $a (local.get $v))
        (local.set $v (v128.load offset=16 (local.get $p)))
        (local.set $v
          (i32x4.add (global.get $b)
            (v128.xor
              (i32x4.shr_u (local.get $v) (i32.const 1))
              (i32x4.neg
                (v128.and (local.get $v) (v128.const i32x4 1 1 1 1))))))
        (v128.store offset=16 (local.get $p) (local.get $v))
        (global.set $b (local.get $v))
        (local.set $p (i32.add (local.get $p) (i32.const 32)))
        (local.set $i (i32.add (local.get $i) (i32.const 1)))
        (br $rows))))
)
