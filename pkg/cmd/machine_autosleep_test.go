package cmd

import "testing"

func TestParseMachineAutosleep(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		value   string
		want    int64
		wantErr bool
	}{
		{name: "off", value: "off", want: 0},
		{name: "seconds", value: "300", want: 300},
		{name: "minutes", value: "30m", want: 1800},
		{name: "hours", value: "2h", want: 7200},
		{name: "negative", value: "-1", wantErr: true},
		{name: "too large", value: "169h", wantErr: true},
		{name: "fractional second", value: "1500ms", wantErr: true},
		{name: "invalid", value: "later", wantErr: true},
		{name: "never", value: "never", wantErr: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			got, err := parseMachineAutosleep(tt.value)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("parseMachineAutosleep(%q) succeeded", tt.value)
				}
				return
			}
			if err != nil {
				t.Fatalf("parseMachineAutosleep(%q): %v", tt.value, err)
			}
			if got != tt.want {
				t.Fatalf("parseMachineAutosleep(%q) = %d, want %d", tt.value, got, tt.want)
			}
		})
	}
}

func TestMachineAutosleepFlagSendsSeconds(t *testing.T) {
	t.Parallel()

	flag := newMachineAutosleepFlag()
	if err := flag.PreParse(); err != nil {
		t.Fatalf("preparse autosleep flag: %v", err)
	}
	if err := flag.Set("autosleep", "30m"); err != nil {
		t.Fatalf("set autosleep flag: %v", err)
	}
	if got, want := flag.Get(), int64(1800); got != want {
		t.Fatalf("autosleep flag value = %v, want %d", got, want)
	}
	if got, want := flag.GetBodyPath(), "autosleep_seconds"; got != want {
		t.Fatalf("autosleep body path = %q, want %q", got, want)
	}
}
