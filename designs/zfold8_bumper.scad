// Samsung Galaxy Z Fold 8 Bumper Case - Clear + Black Bumper
// Based on official Z Fold 8 dims: Unfolded 123.9 x 161.4 x 4.5 mm, Folded 123.9 x 81.9 x 9.7 mm
// Material: PETG, Printer: FlashForge Adventurer 5M

$phone_w = 123.9;
$phone_h = 161.4;
$phone_t = 4.5;
$phone_fold_w = 123.9;
$phone_fold_h = 81.9;
$phone_fold_t = 9.7;

// Case walls
$wall_clear = 2.5;        // clear case wall thickness (mm)
$wall_bumper = 6.0;        // bumper wall thickness (mm)
$bumper_offset = 1.5;     // bumper raised from case wall

// Dimensions
$outer_w = $phone_w + 2*($wall_bumper + $bumper_offset);
$outer_h = $phone_h + 2*($wall_bumper + $bumper_offset);
$outer_t = $phone_t + 2*($wall_clear + $wall_bumper);
$bumper_t = $outer_t - 2*$bumper_offset;

module clear_case() {
    difference() {
        // Outer shell
        translate([0, 0, 0])
            cube([ $outer_w, $outer_h, $outer_t ], center=true);
        
        // Cavity for phone (unfolded)
        translate([0, 0, $wall_bumper + $bumper_offset])
            cube([ $phone_w + 0.8, $phone_h + 0.8, $phone_t + 0.5 ], center=true);
        
        // Cavity for phone (folded - simplified for both states)
        translate([0, 0, $wall_bumper + $bumper_offset])
            cube([ $phone_fold_w + 0.8, $phone_fold_h + 0.8, $phone_fold_t + 0.5 ], center=true);
    }
}

module black_bumper() {
    // Bumper as raised box (simplified - represents protective edges)
    difference() {
        // Bumper block
        translate([0, 0, $bumper_offset])
            cube([ $outer_w - 2*($wall_bumper - $bumper_offset), $outer_h - 2*($wall_bumper - $bumper_offset), $bumper_t ], center=true);
        
        // Subtract inner cavity for phone through bumper
        translate([0, 0, -$bumper_t/2])
            cube([ $phone_w + 1, $phone_h + 1, $phone_t + 2 ], center=true);
    }
}

module full_assembly() {
    // Clear case (transparent gray)
    color([0.9, 0.9, 0.9])
        clear_case();
    
    // Black bumper (raised protective edges)
    color("black")
        black_bumper();
}

full_assembly();

// Print settings text
translate([0, $outer_h/2 + 50, 0])
    linear_extrude(height=0.5)
        text("Samsung Galaxy Z Fold 8\nClear Case + Bumper\nPETG | FlashForge Adventurer 5M", size=4, halign="center", valign="center");
