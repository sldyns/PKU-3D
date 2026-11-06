(module
  (import "env" "hypot3" (func $hypot3 (param f64 f64 f64) (result f64)))
  (type $t0 (func (param i32 i32 i32 i32 i32 i32 i32) (result i32)))
  (func $group (type $t0) (param $base i32) (param $stride i32) (param $start i32) (param $count i32) (param $inside i32) (param $enabled i32) (param $planes i32) (result i32)
    (local $j i32) (local $at i32) (local $at64 i32) (local $plane i32) (local $bits i32) (local $visible i32) (local $lo i32) (local $hi i32) (local $culled i32) (local $x v128) (local $y v128) (local $z v128) (local $r v128) (local $active v128) (local $dx v128) (local $dy v128) (local $dz v128) (local $distance v128) (local $width v128) (local $limit v128)
    block $B0
      loop $L1
        local.get $j
        local.get $count
        i32.ge_u
        br_if $B0
        local.get $base
        local.get $start
        local.get $j
        i32.add
        i32.const 2
        i32.shl
        i32.add
        local.set $at
        local.get $base
        local.get $stride
        i32.const 6
        i32.mul
        i32.add
        local.get $start
        local.get $j
        i32.add
        i32.const 3
        i32.shl
        i32.add
        local.set $at64
        local.get $at
        v128.load64_zero align=4
        f64x2.promote_low_f32x4
        local.set $x
        local.get $at
        local.get $stride
        i32.add
        v128.load64_zero align=4
        f64x2.promote_low_f32x4
        local.set $y
        local.get $at
        local.get $stride
        i32.const 2
        i32.mul
        i32.add
        v128.load64_zero align=4
        f64x2.promote_low_f32x4
        local.set $z
        local.get $at
        local.get $stride
        i32.const 3
        i32.mul
        i32.add
        v128.load64_zero align=4
        f64x2.promote_low_f32x4
        local.set $r
        v128.const i32x4 0xffffffff 0xffffffff 0xffffffff 0xffffffff
        local.set $active
        local.get $j
        i32.const 1
        i32.add
        local.get $count
        i32.ge_u
        if $I2
          v128.const i32x4 0xffffffff 0xffffffff 0x00000000 0x00000000
          local.set $active
        end
        local.get $inside
        i32.eqz
        if $I3
          i32.const 0
          local.set $plane
          block $B4
            loop $L5
              local.get $plane
              local.get $planes
              i32.const 5
              i32.shl
              i32.ge_u
              br_if $B4
              local.get $active
              local.get $plane
              f64.load
              f64x2.splat
              local.get $x
              f64x2.mul
              local.get $plane
              f64.load offset=8
              f64x2.splat
              local.get $y
              f64x2.mul
              f64x2.add
              local.get $plane
              f64.load offset=16
              f64x2.splat
              local.get $z
              f64x2.mul
              f64x2.add
              local.get $plane
              f64.load offset=24
              f64x2.splat
              f64x2.add
              local.get $r
              f64x2.neg
              f64x2.lt
              v128.andnot
              local.set $active
              local.get $active
              v128.any_true
              i32.eqz
              br_if $B4
              local.get $plane
              i32.const 32
              i32.add
              local.set $plane
              br $L5
            end
          end
        end
        local.get $active
        i64x2.bitmask
        local.set $visible
        local.get $enabled
        local.get $visible
        i32.const 0
        i32.ne
        i32.and
        if $I6
          local.get $x
          i32.const 1024
          f64.load
          f64x2.splat
          f64x2.sub
          local.set $dx
          local.get $y
          i32.const 1032
          f64.load
          f64x2.splat
          f64x2.sub
          local.set $dy
          local.get $z
          i32.const 1040
          f64.load
          f64x2.splat
          f64x2.sub
          local.set $dz
          local.get $dx
          local.get $dx
          f64x2.mul
          local.get $dy
          local.get $dy
          f64x2.mul
          f64x2.add
          local.get $dz
          local.get $dz
          f64x2.mul
          f64x2.add
          local.set $distance
          local.get $at64
          v128.load align=8
          local.set $width
          local.get $width
          i32.const 1048
          f64.load
          f64x2.splat
          f64x2.mul
          f64.const 0x1.b333333333333p-1 (;=0.85;)
          f64x2.splat
          f64x2.div
          local.set $limit
          local.get $active
          local.get $width
          f64.const 0x0p+0 (;=0;)
          f64x2.splat
          f64x2.ne
          f64.const 0x1p+0 (;=1;)
          f64x2.splat
          local.get $distance
          f64x2.max
          local.get $limit
          local.get $limit
          f64x2.mul
          f64x2.gt
          v128.and
          v128.andnot
          local.set $active
          local.get $at
          local.get $stride
          i32.const 4
          i32.mul
          i32.add
          v128.load64_zero align=4
          f64x2.promote_low_f32x4
          i32.const 1048
          f64.load
          f64x2.splat
          f64x2.mul
          f64.const 0x1.999999999999ap+0 (;=1.6;)
          f64x2.splat
          f64x2.div
          local.set $limit
          local.get $active
          local.get $at
          local.get $stride
          i32.const 5
          i32.mul
          i32.add
          v128.load64_zero align=4
          f64x2.promote_low_f32x4
          f64.const 0x0p+0 (;=0;)
          f64x2.splat
          f64x2.eq
          local.get $distance
          f64.const 0x1.081p+16 (;=67600;)
          f64x2.splat
          f64x2.ge
          local.get $distance
          local.get $limit
          local.get $limit
          f64x2.mul
          f64x2.gt
          v128.and
          v128.and
          v128.andnot
          local.set $active
        end
        local.get $active
        i64x2.bitmask
        local.set $bits
        local.get $culled
        local.get $visible
        i32.popcnt
        local.get $bits
        i32.popcnt
        i32.sub
        i32.add
        local.set $culled
        local.get $j
        i32.const 32
        i32.lt_u
        if $I7
          local.get $lo
          local.get $bits
          local.get $j
          i32.shl
          i32.or
          local.set $lo
        else
          local.get $hi
          local.get $bits
          local.get $j
          i32.const 32
          i32.sub
          i32.shl
          i32.or
          local.set $hi
        end
        local.get $j
        i32.const 2
        i32.add
        local.set $j
        br $L1
      end
    end
    i32.const 2048
    local.get $lo
    i32.store
    i32.const 2052
    local.get $hi
    i32.store
    local.get $culled)
  (memory $memory 256 256)
  (export "memory" (memory $memory))
  (export "group" (func $group))
  ;; Append an ordered accepted span, merging exactly adjacent source records.
  (func $append (param $out i32) (param $runs i32) (param $start i32) (param $len i32) (result i32)
    (local $last i32)
    (if (local.get $runs)
      (then
        (local.set $last (i32.add (local.get $out) (i32.shl (i32.sub (local.get $runs) (i32.const 1)) (i32.const 3))))
        (if (i32.eq (i32.add (i32.load (local.get $last)) (i32.load offset=4 (local.get $last))) (local.get $start))
          (then (i32.store offset=4 (local.get $last) (i32.add (i32.load offset=4 (local.get $last)) (local.get $len))) (return (local.get $runs))))))
    (local.set $last (i32.add (local.get $out) (i32.shl (local.get $runs) (i32.const 3))))
    (i32.store (local.get $last) (local.get $start))
    (i32.store offset=4 (local.get $last) (local.get $len))
    (i32.add (local.get $runs) (i32.const 1)))
  ;; Group classifications are made with the original JS binary64 expressions.
  ;; Reuse the byte-identical group kernel, then compact masks to exact spans.
  (func $batch (export "batch")
    (param $base i32) (param $stride i32) (param $start i32) (param $count i32)
    (param $enabled i32) (param $planes i32) (param $classes i32) (param $out i32) (result i32)
    (local $k i32) (local $g i32) (local $n i32) (local $status i32)
    (local $lo i32) (local $hi i32) (local $half i32) (local $mask i32)
    (local $bit i32) (local $len i32) (local $runs i32) (local $selected i32) (local $culled i32)
    (block $done (loop $groups
      (br_if $done (i32.ge_u (local.get $k) (local.get $count)))
      (local.set $n (i32.sub (local.get $count) (local.get $k)))
      (if (i32.gt_u (local.get $n) (i32.const 64)) (then (local.set $n (i32.const 64))))
      (local.set $status (i32.load (i32.add (local.get $classes) (i32.shl (local.get $g) (i32.const 2)))))
      (local.set $lo (i32.const 0)) (local.set $hi (i32.const 0))
      (if (i32.eq (local.get $status) (i32.const 2))
        (then (local.set $culled (i32.add (local.get $culled) (local.get $n)))))
      (if (i32.eq (local.get $status) (i32.const 1))
        (then
          (if (i32.ge_u (local.get $n) (i32.const 32))
            (then (local.set $lo (i32.const -1)))
            (else (local.set $lo (i32.sub (i32.shl (i32.const 1) (local.get $n)) (i32.const 1)))))
          (if (i32.gt_u (local.get $n) (i32.const 32))
            (then
              (if (i32.eq (local.get $n) (i32.const 64))
                (then (local.set $hi (i32.const -1)))
                (else (local.set $hi (i32.sub (i32.shl (i32.const 1) (i32.sub (local.get $n) (i32.const 32))) (i32.const 1)))))))))
      (if (i32.ge_u (local.get $status) (i32.const 3))
        (then
          (local.set $culled (i32.add (local.get $culled)
            (call $group (local.get $base) (local.get $stride) (i32.add (local.get $start) (local.get $k)) (local.get $n) (i32.eq (local.get $status) (i32.const 3)) (local.get $enabled) (local.get $planes))))
          (local.set $lo (i32.load (i32.const 2048)))
          (local.set $hi (i32.load (i32.const 2052)))))
      (local.set $half (i32.const 0))
      (block $halvesDone (loop $halves
        (br_if $halvesDone (i32.ge_u (local.get $half) (i32.const 2)))
        (local.set $mask (if (result i32) (local.get $half) (then (local.get $hi)) (else (local.get $lo))))
        (block $maskDone (loop $bits
          (br_if $maskDone (i32.eqz (local.get $mask)))
          (local.set $bit (i32.ctz (local.get $mask)))
          (local.set $len (i32.ctz (i32.xor (i32.shr_u (local.get $mask) (local.get $bit)) (i32.const -1))))
          (local.set $runs (call $append (local.get $out) (local.get $runs)
            (i32.add (i32.add (local.get $start) (local.get $k)) (i32.add (i32.shl (local.get $half) (i32.const 5)) (local.get $bit))) (local.get $len)))
          (local.set $selected (i32.add (local.get $selected) (local.get $len)))
          (local.set $mask (if (result i32) (i32.ge_u (i32.add (local.get $bit) (local.get $len)) (i32.const 32))
            (then (i32.const 0)) (else (i32.and (local.get $mask) (i32.shl (i32.const -1) (i32.add (local.get $bit) (local.get $len)))))))
          (br $bits)))
        (local.set $half (i32.add (local.get $half) (i32.const 1))) (br $halves)))
      (local.set $k (i32.add (local.get $k) (i32.const 64)))
      (local.set $g (i32.add (local.get $g) (i32.const 1))) (br $groups)))
    (i32.store (i32.const 2056) (local.get $runs))
    (i32.store (i32.const 2060) (local.get $selected))
    (local.get $culled))


  ;; Scalar f64 grouping uses the original JS hypot implementation. No sqrt
  ;; substitution or relaxed math. Record classification remains original SIMD.
  (func $classify (export "classify")
    (param $n i32) (param $planes i32) (param $enabled i32)
    (param $detail i32) (param $hasSelected i32)
    (local $k i32) (local $p i32) (local $a i32) (local $d i32)
    (local $inside i32) (local $outside i32) (local $class i32)
    (local $x f64) (local $y f64) (local $z f64) (local $r f64)
    (local $dot f64) (local $distance f64) (local $near f64) (local $far f64) (local $focal f64)
    (local.set $focal (f64.load (i32.const 1048)))
    (block $end (loop $groups
      (br_if $end (i32.ge_u (local.get $k) (local.get $n)))
      (local.set $a (i32.add (i32.const 270336) (i32.mul (local.get $k) (i32.const 40))))
      (local.set $x (f64.load (local.get $a)))
      (local.set $y (f64.load offset=8 (local.get $a)))
      (local.set $z (f64.load offset=16 (local.get $a)))
      (local.set $r (f64.add (f64.load offset=24 (local.get $a)) (f64.mul (f64.const 0) (f64.load offset=32 (local.get $a)))))
      (local.set $inside (i32.const 1)) (local.set $outside (i32.const 0)) (local.set $p (i32.const 0))
      (block $planeEnd (loop $planeLoop
        (br_if $planeEnd (i32.ge_u (local.get $p) (local.get $planes)))
        (local.set $a (i32.mul (local.get $p) (i32.const 32)))
        (local.set $dot (f64.add (f64.add (f64.add
          (f64.mul (f64.load (local.get $a)) (local.get $x))
          (f64.mul (f64.load offset=8 (local.get $a)) (local.get $y)))
          (f64.mul (f64.load offset=16 (local.get $a)) (local.get $z)))
          (f64.load offset=24 (local.get $a))))
        (if (f64.lt (local.get $dot) (f64.neg (local.get $r))) (then (local.set $outside (i32.const 1)) (br $planeEnd)))
        (if (f64.lt (local.get $dot) (local.get $r)) (then (local.set $inside (i32.const 0))))
        (local.set $p (i32.add (local.get $p) (i32.const 1))) (br $planeLoop)))
      (local.set $class (select (i32.const 3) (i32.const 4) (local.get $inside)))
      (if (local.get $outside) (then (local.set $class (i32.const 0)))
        (else (if (i32.and (i32.and (local.get $inside) (local.get $detail))
            (i32.eqz (i32.load8_u (i32.add (i32.const 344064) (local.get $k)))))
          (then
            (local.set $d (i32.add (i32.const 311296) (i32.mul (local.get $k) (i32.const 32))))
            (local.set $distance (call $hypot3
              (f64.sub (local.get $x) (f64.load (i32.const 1024)))
              (f64.sub (local.get $y) (f64.load (i32.const 1032)))
              (f64.sub (local.get $z) (f64.load (i32.const 1040)))))
            (local.set $far (f64.add (local.get $distance) (local.get $r)))
            (local.set $near (f64.max (f64.const 0) (f64.sub (local.get $distance) (local.get $r))))
            (if (i32.and (local.get $enabled) (i32.or
              (i32.and (i32.and (f64.ge (local.get $near) (f64.const 260)) (i32.eqz (local.get $hasSelected)))
                (f64.gt (local.get $near) (f64.div (f64.mul (f64.load offset=16 (local.get $d)) (local.get $focal)) (f64.const 1.6))))
              (f64.gt (f64.max (f64.const 1) (local.get $near)) (f64.div (f64.mul (f64.load offset=24 (local.get $d)) (local.get $focal)) (f64.const 0.85)))))
              (then (local.set $class (i32.const 2)))
              (else (if (i32.or (i32.eqz (local.get $enabled)) (i32.and
                (i32.or (f64.lt (local.get $far) (f64.const 260)) (f64.lt (local.get $far) (f64.div (f64.mul (f64.load (local.get $d)) (local.get $focal)) (f64.const 1.6))))
                (f64.lt (f64.max (f64.const 1) (local.get $far)) (f64.div (f64.mul (f64.load offset=8 (local.get $d)) (local.get $focal)) (f64.const 0.85)))))
                (then (local.set $class (i32.const 1))))))
          ))))
      (i32.store (i32.add (i32.const 4096) (i32.mul (local.get $k) (i32.const 4))) (local.get $class))
      (local.set $k (i32.add (local.get $k) (i32.const 1))) (br $groups)))
  )

)
