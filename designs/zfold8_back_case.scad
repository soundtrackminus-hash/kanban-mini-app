// Samsung Galaxy Z Fold 8 — Rear Case (folded), PETG
// Snug-fit back cover for FlashForge Adventurer 5M

// --- Phone dimensions (folded) ---
phone_w = 123.9;   // width
phone_h = 81.9;    // height
phone_t = 9.7;     // thickness

// --- Case parameters ---
wall = 2.0;               // case wall thickness
clearance = 0.3;          // gap between phone and case (snug fit)
lip = 1.5;                // lip over front edge
lip_overlap = 0.5;        // how far lip wraps onto front

// --- Derived ---
inner_w = phone_w + clearance;
inner_h = phone_h + clearance;
inner_t = phone_t + clearance;
outer_w = inner_w + 2*wall;
outer_h = inner_h + 2*wall;
outer_t = inner_t + wall + lip;  // back wall + lip

$fn = 32;

// --- Main module ---
module back_case() {
    difference() {
        // Outer block
        cube([outer_w, outer_h, outer_t]);

        // Inner cavity (phone space + clearance)
        translate([wall, wall, wall])
            cube([inner_w, inner_h, inner_t]);

        // Lip cutout at front edge (so phone can slide in)
        translate([wall, wall, outer_t - lip - clearance])
            cube([inner_w, inner_h, lip + clearance]);
    }

    // Lip around front edge (wraps onto front face)
    translate([0, 0, outer_t - lip])
        cube([outer_w, outer_h, lip]);

    // Camera cutout (centered, typical Fold 8 camera bump)
    translate([outer_w/2 - 8, outer_h - 25, outer_t - 8])
        cube([16, 14, 8]);

    // Side button cutouts (right side, folded)
    translate([outer_w - wall - 3, outer_h/2 - 5, wall + 3])
        cube([3, 10, 6]);
}

back_case();