"""Terminal client for the refinement engine.

The CLI talks to ``RefinementService`` directly over a local SQLAlchemy session
rather than over HTTP: the point is to run inside a code repository without
starting a server or a browser.
"""
