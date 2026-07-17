import sbt.Keys.*
import sbt.*

object DependenciesPlugin extends AutoPlugin {
  override def trigger =
    allRequirements

  object autoImport {
    implicit class DependencyOps(p: Project) {
      def withEffectMonad: Project =
        p.settings(
          libraryDependencies += "org.typelevel" %% "cats-effect" % Versions.catsEffect
        )

      def withHttpServer: Project =
        p
          .withEffectMonad
          .settings(
            libraryDependencies ++= Seq(
              "org.http4s" %% "http4s-ember-server" % Versions.http4s,
              "org.http4s" %% "http4s-dsl"          % Versions.http4s,
              "org.http4s" %% "http4s-scalatags"    % Versions.http4sScalatags,
              "org.http4s" %% "http4s-circe"        % Versions.http4s
            )
          )

      def withJson: Project =
        p.settings(
          libraryDependencies ++= Seq(
            "io.circe" %% "circe-generic" % Versions.circe,
            "io.circe" %% "circe-parser"  % Versions.circe
          )
        )

      def withYaml: Project =
        p.settings(
          libraryDependencies += "io.circe" %% "circe-yaml" % Versions.circeYaml
        )

      def withLogging: Project =
        p.settings(
          libraryDependencies += "org.slf4j" % "slf4j-simple" % Versions.slf4jSimple
        )

      def withTesting: Project =
        p.settings(
          libraryDependencies ++= Seq(
            "org.typelevel" %% "weaver-cats"       % Versions.weaver % Test,
            "org.typelevel" %% "weaver-scalacheck" % Versions.weaver % Test
          )
        )
    }
  }
}
