#!/usr/bin/env python
print("User Guide: https://jampy-docs-v7.readthedocs.io/")

import sys
import urllib.request
import json

try:
    # Python 3.8+
    from importlib.metadata import version, PackageNotFoundError
except ImportError:
    # Fallback for Python <3.8
    from importlib_metadata import version, PackageNotFoundError


def check_for_new_version(package: str):
    try:
        current_version = version(package)
        with urllib.request.urlopen(f"https://pypi.org/pypi/{package}/json", timeout=2) as resp:
            data = json.load(resp)
            latest_version = data["info"]["version"]

        if current_version != latest_version:
            print(
                f"\nA new version of {package} is available: "
                f"{current_version} → {latest_version}\n"
            )
        else:
            print(f"{package} is up-to-date ({current_version})")

    except PackageNotFoundError:
        print(f"{package} is not installed in this environment.")
    except Exception as e:
        print(f"Version check skipped, no network.")


if __name__ == '__main__':
    # --- version check at startup ---
    check_for_new_version("jam-py-v7")

    # --- Jam.py startup ---
    from jam.wsgi import create_application
    from jam.wsgi_server import run

    application = create_application(__file__)
    run(application)

