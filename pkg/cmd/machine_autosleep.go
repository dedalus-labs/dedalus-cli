package cmd

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/dedalus-labs/dedalus-cli/internal/requestflag"
)

const maxMachineAutosleepSeconds int64 = 604800

type machineAutosleepFlag struct {
	requestflag.Flag[string]
}

func init() {
	machinesCreate.Flags = append(machinesCreate.Flags, newMachineAutosleepFlag())
	machinesUpdate.Flags = append(machinesUpdate.Flags, newMachineAutosleepFlag())
}

func newMachineAutosleepFlag() *machineAutosleepFlag {
	return &machineAutosleepFlag{
		Flag: requestflag.Flag[string]{
			Name:     "autosleep",
			Usage:    "Idle window before autosleep, such as 30m or 2h. Use off to disable.",
			BodyPath: "autosleep_seconds",
		},
	}
}

func (f *machineAutosleepFlag) Set(name string, value string) error {
	if _, err := parseMachineAutosleep(value); err != nil {
		return err
	}
	return f.Flag.Set(name, value)
}

func (f *machineAutosleepFlag) Get() any {
	seconds, err := parseMachineAutosleep(f.Flag.Get().(string))
	if err != nil {
		return int64(0)
	}
	return seconds
}

func parseMachineAutosleep(value string) (int64, error) {
	normalized := strings.TrimSpace(strings.ToLower(value))
	switch normalized {
	case "":
		return 0, fmt.Errorf("autosleep must be a duration like 30m, raw seconds, or off")
	case "off":
		return 0, nil
	}

	if seconds, err := strconv.ParseInt(normalized, 10, 64); err == nil {
		return validateMachineAutosleep(seconds)
	}

	duration, err := time.ParseDuration(normalized)
	if err != nil {
		return 0, fmt.Errorf("autosleep must be a duration like 30m, raw seconds, or off")
	}
	if duration%time.Second != 0 {
		return 0, fmt.Errorf("autosleep must resolve to whole seconds")
	}
	return validateMachineAutosleep(int64(duration / time.Second))
}

func validateMachineAutosleep(seconds int64) (int64, error) {
	if seconds < 0 {
		return 0, fmt.Errorf("autosleep must be >= 0 seconds")
	}
	if seconds > maxMachineAutosleepSeconds {
		return 0, fmt.Errorf("autosleep must be <= %d seconds", maxMachineAutosleepSeconds)
	}
	return seconds, nil
}
